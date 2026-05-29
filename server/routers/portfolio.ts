import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, publicProcedure, protectedProcedure, rateLimitedPortfolioProcedure } from "../trpc"
import { redis, RedisKeys, TTL } from "@/lib/redis"
import { logger } from "@/lib/logger"

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const customFieldSchema = z.object({
  key: z.string().min(1).max(50),
  value: z.string().max(500),
  type: z.enum(["TEXT", "URL", "DATE", "IMAGE"]).default("TEXT"),
})

const itemSchema = z.object({
  id: z.string().optional(),
  order: z.number().int().min(0),
  fieldsJson: z.record(z.string(), z.string().nullable()),
  customFields: z.array(customFieldSchema).optional().default([]),
})

const sectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(100),
  order: z.number().int().min(0),
  items: z.array(itemSchema),
})

const updateFullSchema = z.object({
  portfolioId: z.string(),
  title: z.string().min(1).max(200).optional(),
  sections: z.array(sectionSchema),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function invalidateCache(slug: string) {
  try {
    await redis.del(RedisKeys.cvCache(slug))
  } catch {
    // Non-fatal
  }
}

async function getPortfolioWithOwnerCheck(
  prisma: any,
  portfolioId: string,
  userId: string
) {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
  })
  if (!portfolio) throw new TRPCError({ code: "NOT_FOUND" })
  if (portfolio.userId !== userId) throw new TRPCError({ code: "FORBIDDEN" })
  return portfolio
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const portfolioRouter = createTRPCRouter({
  // PUBLIC: Get portfolio by slug (with Redis cache)
  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      // Try cache first
      try {
        const cached = await redis.get<string>(RedisKeys.cvCache(input.slug))
        if (cached) {
          return typeof cached === "string" ? JSON.parse(cached) : cached
        }
      } catch {
        // Redis unavailable — fall through to DB
      }

      const portfolio = await ctx.prisma.portfolio.findUnique({
        where: { slug: input.slug, isPublished: true },
        include: {
          user: { select: { username: true } },
          sections: {
            orderBy: { order: "asc" },
            include: {
              items: {
                orderBy: { order: "asc" },
                include: { customFields: true },
              },
            },
          },
        },
      })

      if (!portfolio) return null

      // Cache it
      try {
        await redis.set(RedisKeys.cvCache(input.slug), JSON.stringify(portfolio), {
          ex: TTL.CV_CACHE,
        })
      } catch {
        // Non-fatal
      }

      return portfolio
    }),

  // PUBLIC: Increment view count (fire-and-forget style)
  incrementView: publicProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await redis.incr(RedisKeys.cvViews(input.slug))
      } catch {
        // Non-fatal
      }
      return { ok: true }
    }),

  // PROTECTED: Get all portfolios for current user
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.portfolio.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { sections: true } },
      },
    })
  }),

  // PROTECTED: Get single portfolio for editing (no published restriction)
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const portfolio = await ctx.prisma.portfolio.findUnique({
        where: { id: input.id },
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: {
              items: {
                orderBy: { order: "asc" },
                include: { customFields: true },
              },
            },
          },
        },
      })
      if (!portfolio) throw new TRPCError({ code: "NOT_FOUND" })
      if (portfolio.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }
      return portfolio
    }),

  // PROTECTED: Create new portfolio
  create: rateLimitedPortfolioProcedure
    .input(z.object({ title: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const username = ctx.session.user.username

      // Generate unique slug
      const baseSlug = username
      let slug = baseSlug
      let counter = 1
      while (await ctx.prisma.portfolio.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter++}`
      }

      return ctx.prisma.portfolio.create({
        data: {
          title: input.title,
          slug,
          userId: ctx.session.user.id,
          sections: {
            create: [
              { title: "О себе", order: 0 },
              { title: "Опыт работы", order: 1 },
              { title: "Навыки", order: 2 },
            ],
          },
        },
        include: {
          sections: {
            include: { items: true },
          },
        },
      })
    }),

  // PROTECTED: Update portfolio meta (title, slug)
  updateMeta: rateLimitedPortfolioProcedure
    .input(
      z.object({
        portfolioId: z.string(),
        title: z.string().min(1).max(200).optional(),
        slug: z
          .string()
          .min(3)
          .max(50)
          .regex(/^[a-z0-9-]+$/)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const portfolio = await getPortfolioWithOwnerCheck(
        ctx.prisma,
        input.portfolioId,
        ctx.session.user.id
      )

      // If slug changing, check uniqueness
      if (input.slug && input.slug !== portfolio.slug) {
        const existing = await ctx.prisma.portfolio.findUnique({
          where: { slug: input.slug },
        })
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Slug already taken" })
        await invalidateCache(portfolio.slug)
      }

      const updated = await ctx.prisma.portfolio.update({
        where: { id: input.portfolioId },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.slug && { slug: input.slug }),
        },
      })

      if (input.slug) await invalidateCache(input.slug)
      return updated
    }),

  // PROTECTED: Full structure update (sections + items + fieldsJson)
  updateFull: rateLimitedPortfolioProcedure
    .input(updateFullSchema)
    .mutation(async ({ ctx, input }) => {
      const portfolio = await getPortfolioWithOwnerCheck(
        ctx.prisma,
        input.portfolioId,
        ctx.session.user.id
      )

      // Transactionally replace all sections and items
      await ctx.prisma.$transaction(async (tx) => {
        // Update title if provided
        if (input.title) {
          await tx.portfolio.update({
            where: { id: input.portfolioId },
            data: { title: input.title, updatedAt: new Date() },
          })
        }

        // Delete existing sections (cascade deletes items + customFields)
        await tx.section.deleteMany({ where: { portfolioId: input.portfolioId } })

        // Re-create everything
        for (const section of input.sections) {
          const newSection = await tx.section.create({
            data: {
              title: section.title,
              order: section.order,
              portfolioId: input.portfolioId,
            },
          })

          for (const item of section.items) {
            const newItem = await tx.item.create({
              data: {
                order: item.order,
                sectionId: newSection.id,
                fieldsJson: item.fieldsJson,
              },
            })

            if (item.customFields && item.customFields.length > 0) {
              await tx.customField.createMany({
                data: item.customFields.map((cf) => ({
                  itemId: newItem.id,
                  key: cf.key,
                  value: cf.value,
                  type: cf.type,
                })),
              })
            }
          }
        }
      })

      await invalidateCache(portfolio.slug)
      logger.info({ portfolioId: input.portfolioId }, "Portfolio updated")
      return { ok: true }
    }),

  // PROTECTED: Publish portfolio
  publish: rateLimitedPortfolioProcedure
    .input(z.object({ portfolioId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const portfolio = await getPortfolioWithOwnerCheck(
        ctx.prisma,
        input.portfolioId,
        ctx.session.user.id
      )

      const updated = await ctx.prisma.portfolio.update({
        where: { id: input.portfolioId },
        data: { isPublished: true, publishedAt: new Date() },
      })

      await invalidateCache(portfolio.slug)
      return updated
    }),

  // PROTECTED: Unpublish portfolio
  unpublish: rateLimitedPortfolioProcedure
    .input(z.object({ portfolioId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const portfolio = await getPortfolioWithOwnerCheck(
        ctx.prisma,
        input.portfolioId,
        ctx.session.user.id
      )

      const updated = await ctx.prisma.portfolio.update({
        where: { id: input.portfolioId },
        data: { isPublished: false },
      })

      await invalidateCache(portfolio.slug)
      return updated
    }),

  // PROTECTED: Delete portfolio
  delete: rateLimitedPortfolioProcedure
    .input(z.object({ portfolioId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const portfolio = await getPortfolioWithOwnerCheck(
        ctx.prisma,
        input.portfolioId,
        ctx.session.user.id
      )

      await ctx.prisma.portfolio.delete({ where: { id: input.portfolioId } })
      await invalidateCache(portfolio.slug)

      logger.info({ portfolioId: input.portfolioId }, "Portfolio deleted")
      return { ok: true }
    }),

  // PROTECTED: Get presigned URL for media upload
  getPresignedUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string().regex(/^image\//),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { createClient } = await import("@supabase/supabase-js")
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      )

      const ext = input.filename.split(".").pop()
      const path = `${ctx.session.user.id}/${Date.now()}.${ext}`

      const { data, error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET!)
        .createSignedUploadUrl(path)

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message })

      const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/${path}`

      return { uploadUrl: data.signedUrl, publicUrl, path }
    }),
})
