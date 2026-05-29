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
  PENDING_REG: 15 * 60,    // 15 min
  CODE: 5 * 60,            // 5 min
  RESET_TOKEN: 10 * 60,    // 10 min
  CV_CACHE: 5 * 60,        // 5 min
} as const

export async function isRedisAvailable(): Promise<boolean> {
  try {
    await redis.ping()
    return true
  } catch {
    return false
  }
}
