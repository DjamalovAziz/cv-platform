import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcrypt"
import { prisma } from "@/lib/prisma"
import { redis, RedisKeys } from "@/lib/redis"
import { securityLogger } from "@/lib/logger"

const schema = z.object({
  resetToken: z.string().uuid(),
  code: z.string().length(4).regex(/^\d{4}$/),
  newPassword: z
    .string()
    .min(8)
    .regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, "Must contain letter and number"),
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
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { resetToken, code, newPassword } = parsed.data

  const raw = await redis.get<string>(RedisKeys.resetToken(resetToken))
  if (!raw) {
    return NextResponse.json({ error: "TOKEN_EXPIRED" }, { status: 400 })
  }

  const { userId, code: storedCode } = JSON.parse(
    typeof raw === "string" ? raw : JSON.stringify(raw)
  )

  if (storedCode !== code) {
    securityLogger.warn({ userId }, "Invalid reset code attempt")
    return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)

  // updatedAt = new Date() invalidates ALL existing JWT tokens for this user
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, updatedAt: new Date() },
  })

  await redis.del(RedisKeys.resetToken(resetToken))

  securityLogger.info({ userId }, "Password reset successfully — all sessions invalidated")
  return NextResponse.json({ success: true })
}
