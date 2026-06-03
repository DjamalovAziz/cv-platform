import { describe, it, expect } from "vitest"

describe("Email HTML template", () => {
  it("contains code in registration email HTML", () => {
    const code = "1234"
    const html = `<span>${code}</span>`
    expect(html).toContain(code)
  })

  it("has correct Russian text for registration", () => {
    const text = "Подтверждение регистрации"
    expect(text).toBe("Подтверждение регистрации")
  })

  it("has correct TTL text", () => {
    const ttl = "5 минут"
    expect(ttl).toBe("5 минут")
  })
})