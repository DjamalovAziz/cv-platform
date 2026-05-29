import { Ratelimit } from "@upstash/ratelimit"
import { redis } from "./redis"

export const rateLimiters = {
  // 3 signup attempts per IP per minute
  signup: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "60 s"),
    prefix: "rl:signup",
  }),
  // 5 code verification attempts per pendingId per minute
  verify: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    prefix: "rl:verify",
  }),
  // 2 password reset requests per target per minute
  forgot: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(2, "60 s"),
    prefix: "rl:forgot",
  }),
  // 20 portfolio mutations per user per minute
  portfolio: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    prefix: "rl:portfolio",
  }),
  // 100 public page requests per IP per minute
  publicRead: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "60 s"),
    prefix: "rl:public",
  }),
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; retryAfter?: number }> {
  try {
    const result = await limiter.limit(identifier)
    if (!result.success) {
      return {
        success: false,
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
      }
    }
    return { success: true }
  } catch {
    // If Redis is down, allow the request (fail open for UX)
    return { success: true }
  }
}
