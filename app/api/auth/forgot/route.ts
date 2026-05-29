import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { redis, RedisKeys, TTL } from "@/lib/redis"
import { rateLimiters, checkRateLimit, getClientIp } from "@/lib/ratelimit"
import { sendPasswordResetEmail } from "@/lib/email"
import { securityLogger } from "@/lib/logger"

const schema = z.object({
  identifier: z.string().min(1).max(255), // username or email
})

const FIXED_RESPONSE = {
  message: "Если аккаунт существует, инструкции были отправлены",
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await checkRateLimit(rateLimiters.forgot, `ip:${ip}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: "TOO_MANY_REQUESTS" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

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

  const { identifier } = parsed.data

  // TIMING PROTECTION: artificial delay BEFORE DB lookup
  // This makes it impossible to enumerate users by measuring response time
  const delay = new Promise((r) => setTimeout(r, 1500))

  const userPromise = prisma.user.findFirst({
    where: {
      OR: [{ username: identifier }, { email: identifier }],
    },
  })

  const [, user] = await Promise.all([delay, userPromise])

  if (user && (user.email || user.telegramId)) {
    const resetToken = randomUUID()
    const code = String(Math.floor(1000 + Math.random() * 9000))

    await redis.set(
      RedisKeys.resetToken(resetToken),
      JSON.stringify({ userId: user.id, code }),
      { ex: TTL.RESET_TOKEN }
    )

    if (user.authMethod === "EMAIL" && user.email) {
      sendPasswordResetEmail(user.email, code).catch((err) =>
        securityLogger.error({ err, userId: user.id }, "Failed to send reset email")
      )
      securityLogger.info({ userId: user.id }, "Password reset requested via email")
    } else if (user.telegramId) {
      // For Telegram, return deep link in response
      const botUsername = process.env.TELEGRAM_BOT_USERNAME
      const deepLink = `https://t.me/${botUsername}?start=reset_${resetToken}`
      // Still return fixed message, but include deepLink for Telegram users
      return NextResponse.json({ ...FIXED_RESPONSE, deepLink, method: "TELEGRAM" })
    }
  } else {
    securityLogger.warn({ identifier }, "Password reset for non-existent user (suppressed)")
  }

  return NextResponse.json(FIXED_RESPONSE)
}
