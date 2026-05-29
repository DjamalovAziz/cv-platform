import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { redis, RedisKeys, TTL } from "@/lib/redis"
import { rateLimiters, checkRateLimit, getClientIp } from "@/lib/ratelimit"
import { sendVerificationEmail } from "@/lib/email"
import { logger } from "@/lib/logger"

const schema = z.object({
  pendingId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await checkRateLimit(rateLimiters.signup, `resend:${ip}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: "TOO_MANY_REQUESTS" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 })
  }

  const { pendingId } = parsed.data

  const raw = await redis.get<string>(RedisKeys.pendingReg(pendingId))
  if (!raw) {
    return NextResponse.json({ error: "SESSION_EXPIRED" }, { status: 400 })
  }

  const data = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw))

  if (data.authMethod === "EMAIL" && data.email) {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    await redis.del(RedisKeys.code(pendingId))
    await redis.set(RedisKeys.code(pendingId), code, { ex: TTL.CODE })

    sendVerificationEmail(data.email, code).catch((err) =>
      logger.error({ err }, "Failed to resend verification email")
    )

    return NextResponse.json({ ok: true, method: "EMAIL" })
  }

  if (data.authMethod === "TELEGRAM") {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME
    const deepLink = `https://t.me/${botUsername}?start=reg_${pendingId}`
    return NextResponse.json({ ok: true, method: "DEEPLINK", deepLink })
  }

  return NextResponse.json({ error: "UNKNOWN_METHOD" }, { status: 400 })
}
