import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { redis, RedisKeys } from "@/lib/redis"
import { rateLimiters, checkRateLimit } from "@/lib/ratelimit"
import { securityLogger, logger } from "@/lib/logger"

const schema = z.object({
  pendingId: z.string().uuid(),
  code: z.string().length(4).regex(/^\d{4}$/),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 })
  }

  const { pendingId, code } = parsed.data

  // Rate limit per pendingId to prevent brute force
  const rl = await checkRateLimit(rateLimiters.verify, `verify:${pendingId}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: "TOO_MANY_REQUESTS" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

  // Check code
  const storedCode = await redis.get<string>(RedisKeys.code(pendingId))
  if (!storedCode) {
    return NextResponse.json({ error: "CODE_EXPIRED" }, { status: 400 })
  }

  if (storedCode !== code) {
    securityLogger.warn({ pendingId }, "Invalid verification code attempt")
    return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 })
  }

  // Get pending registration data
  const raw = await redis.get<string>(RedisKeys.pendingReg(pendingId))
  if (!raw) {
    return NextResponse.json({ error: "SESSION_EXPIRED" }, { status: 400 })
  }

  const pendingData = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw))

  // Create user in transaction
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: pendingId,
          username: pendingData.username,
          passwordHash: pendingData.passwordHash,
          email: pendingData.email ?? null,
          telegramId: pendingData.telegramChatId ? String(pendingData.telegramChatId) : null,
          authMethod: pendingData.authMethod,
          isVerified: true,
          verifiedAt: new Date(),
        },
      })

      // Create default portfolio
      await tx.portfolio.create({
        data: {
          title: `CV — ${pendingData.username}`,
          slug: pendingData.username,
          userId: pendingId,
          sections: {
            create: [
              { title: "О себе", order: 0 },
              { title: "Опыт работы", order: 1 },
              { title: "Навыки", order: 2 },
            ],
          },
        },
      })
    })

    // Cleanup Redis
    await Promise.all([
      redis.del(RedisKeys.code(pendingId)),
      redis.del(RedisKeys.pendingReg(pendingId)),
    ])

    logger.info({ userId: pendingId, username: pendingData.username }, "User registered successfully")
    return NextResponse.json({ success: true, username: pendingData.username })
  } catch (err: any) {
    if (err.code === "P2002") {
      // Prisma unique constraint — username or email already exists
      return NextResponse.json({ error: "USERNAME_TAKEN" }, { status: 409 })
    }
    logger.error({ err, pendingId }, "Failed to create user")
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
