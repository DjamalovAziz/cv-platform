import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { redis } from "@/lib/redis"

export async function GET() {
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.ping(),
  ])

  const db = checks[0].status === "fulfilled"
  const cache = checks[1].status === "fulfilled"

  const status = db ? (cache ? "healthy" : "degraded") : "unhealthy"
  const code = db ? 200 : 503

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      checks: { db, redis: cache },
    },
    { status: code }
  )
}
