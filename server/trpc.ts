import { initTRPC, TRPCError } from "@trpc/server"
import { getServerSession } from "next-auth"
import { ZodError } from "zod"
import superjson from "superjson"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { rateLimiters, checkRateLimit } from "@/lib/ratelimit"
import { type NextRequest } from "next/server"

export async function createTRPCContext(opts: { req: NextRequest }) {
  const session = await getServerSession(authOptions)
  return {
    prisma,
    session,
    req: opts.req,
  }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

// Auth middleware
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  })
})

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed)

// Rate limit middleware for portfolio mutations
const enforcePortfolioRateLimit = t.middleware(async ({ ctx, next }) => {
  if (ctx.session?.user?.id) {
    const result = await checkRateLimit(
      rateLimiters.portfolio,
      `uid:${ctx.session.user.id}`
    )
    if (!result.success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Retry after ${result.retryAfter}s`,
      })
    }
  }
  return next()
})

export const rateLimitedPortfolioProcedure = protectedProcedure.use(
  enforcePortfolioRateLimit
)
