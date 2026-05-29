import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { redis, RedisKeys, TTL } from "@/lib/redis"
import { CVRenderer } from "@/components/cv/CVRenderer"

interface Props {
  params: { username: string }
}

async function getPortfolio(slug: string) {
  // Try Redis cache first
  try {
    const cached = await redis.get<string>(RedisKeys.cvCache(slug))
    if (cached) {
      return typeof cached === "string" ? JSON.parse(cached) : cached
    }
  } catch {
    // Redis down — fall through to DB
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { slug, isPublished: true },
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

  if (portfolio) {
    try {
      await redis.set(RedisKeys.cvCache(slug), JSON.stringify(portfolio), {
        ex: TTL.CV_CACHE,
      })
    } catch {
      // Non-fatal
    }
  }

  return portfolio
}

async function incrementViewCount(slug: string) {
  try {
    await redis.incr(RedisKeys.cvViews(slug))
  } catch {
    // Non-fatal
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const portfolio = await getPortfolio(params.username)
  if (!portfolio) return { title: "Не найдено" }

  return {
    title: portfolio.title,
    description: `Портфолио ${portfolio.user.username} на CV Platform`,
    openGraph: {
      title: portfolio.title,
      type: "profile",
      images: [`/api/og?slug=${params.username}`],
    },
  }
}

export default async function PublicCVPage({ params }: Props) {
  const portfolio = await getPortfolio(params.username)
  if (!portfolio) notFound()

  // Fire-and-forget view increment
  incrementViewCount(params.username)

  return <CVRenderer portfolio={portfolio} />
}
