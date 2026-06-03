import { describe, it, expect } from "vitest"
import { RedisKeys, TTL } from "../../lib/redis"

describe("Redis keys", () => {
  it("generates correct pending registration key", () => {
    expect(RedisKeys.pendingReg("user123")).toBe("pending_reg:user123")
  })

  it("generates correct code key", () => {
    expect(RedisKeys.code("user456")).toBe("code:user456")
  })

  it("generates correct CV cache key", () => {
    expect(RedisKeys.cvCache("john-doe")).toBe("cv:john-doe")
  })

  it("generates correct CV views key", () => {
    expect(RedisKeys.cvViews("john-doe")).toBe("cv_view:john-doe")
  })
})

describe("TTL values", () => {
  it("has correct pending registration TTL", () => {
    expect(TTL.PENDING_REG).toBe(15 * 60) // 15 minutes in seconds
  })

  it("has correct code TTL", () => {
    expect(TTL.CODE).toBe(5 * 60) // 5 minutes in seconds
  })

  it("has correct reset token TTL", () => {
    expect(TTL.RESET_TOKEN).toBe(10 * 60) // 10 minutes in seconds
  })
})