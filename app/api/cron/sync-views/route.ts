import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { redis } from "@/lib/redis"
import { logger } from "@/lib/logger"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    const keys = await redis.keys("cv_view:*")
    let synced = 0

    for (const key of keys) {
      const slug = key.replace("cv_view:", "")
      // GETDEL atomically gets and removes the counter
      const views = await redis.getdel(key) as number | null

      if (views && Number(views) > 0) {
        try {
          await prisma.portfolio.update({
            where: { slug },
            data: { viewCount: { increment: Number(views) } },
          })
          synced++
        } catch (err) {
          // Portfolio might have been deleted — restore the count
          logger.warn({ slug, views }, "Could not sync views for portfolio")
        }
      }
    }

    logger.info({ synced, total: keys.length }, "View counts synced to DB")
    return NextResponse.json({ ok: true, synced, total: keys.length })
  } catch (err) {
    logger.error({ err }, "Cron sync-views failed")
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
