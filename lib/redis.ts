import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Key helpers
export const RedisKeys = {
  pendingReg: (userId: string) => `pending_reg:${userId}`,
  code: (userId: string) => `code:${userId}`,
  resetToken: (token: string) => `reset_token:${token}`,
  cvCache: (slug: string) => `cv:${slug}`,
  cvViews: (slug: string) => `cv_view:${slug}`,
}

// TTLs in seconds
export const TTL = {
  PENDING_REG: 15 * 60,
  CODE: 5 * 60,
  RESET_TOKEN: 10 * 60,
  CV_CACHE: 5 * 60,
} as const

export async function isRedisAvailable(): Promise<boolean> {
  try {
    await redis.ping()
    return true
  } catch {
    return false
  }
}

export async function setCode(pendingId: string, code: string) {
  await redis.set(RedisKeys.code(pendingId), code, { ex: TTL.CODE })
}

export async function setPendingReg(
  pendingId: string,
  data: Record<string, any>,
  ttl = TTL.PENDING_REG
) {
  await redis.set(RedisKeys.pendingReg(pendingId), JSON.stringify(data), {
    ex: ttl,
  })
}
