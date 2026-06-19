import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/redis", () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    ttl: vi.fn().mockResolvedValue(900),
    ping: vi.fn().mockResolvedValue("PONG"),
    keys: vi.fn(),
    incr: vi.fn(),
  }
  return {
    redis: mockRedis,
    RedisKeys: {
      pendingReg: (userId: string) => `pending_reg:${userId}`,
      code: (userId: string) => `code:${userId}`,
      resetToken: (token: string) => `reset_token:${token}`,
      cvCache: (slug: string) => `cv:${slug}`,
      cvViews: (slug: string) => `cv_view:${slug}`,
    },
    TTL: {
      PENDING_REG: 15 * 60,
      CODE: 5 * 60,
      RESET_TOKEN: 10 * 60,
      CV_CACHE: 5 * 60,
    },
    isRedisAvailable: vi.fn().mockResolvedValue(true),
  }
})

import { RedisKeys, TTL } from "@/lib/redis"

describe("Redis helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("RedisKeys", () => {
    it("generates correct pending_reg key", () => {
      expect(RedisKeys.pendingReg("user123")).toBe("pending_reg:user123")
    })

    it("generates correct code key", () => {
      expect(RedisKeys.code("user456")).toBe("code:user456")
    })

    it("generates correct reset_token key", () => {
      expect(RedisKeys.resetToken("token-abc")).toBe("reset_token:token-abc")
    })

    it("generates correct cv cache key", () => {
      expect(RedisKeys.cvCache("john-doe")).toBe("cv:john-doe")
    })

    it("generates correct cv_views key", () => {
      expect(RedisKeys.cvViews("john-doe")).toBe("cv_view:john-doe")
    })
  })

  describe("TTL constants", () => {
    it("pending_reg TTL is 15 minutes", () => {
      expect(TTL.PENDING_REG).toBe(15 * 60)
    })

    it("code TTL is 5 minutes", () => {
      expect(TTL.CODE).toBe(5 * 60)
    })

    it("reset_token TTL is 10 minutes", () => {
      expect(TTL.RESET_TOKEN).toBe(10 * 60)
    })

    it("CV cache TTL is 5 minutes", () => {
      expect(TTL.CV_CACHE).toBe(5 * 60)
    })

    it("all TTLs are positive integers", () => {
      Object.values(TTL).forEach((v) => {
        expect(typeof v).toBe("number")
        expect(v > 0).toBe(true)
      })
    })
  })
})
