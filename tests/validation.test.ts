import { describe, it, expect } from "vitest"
import { z } from "zod"

const signupSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers and underscores"),
  password: z
    .string()
    .min(8)
    .regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, "Must contain letter and number"),
  authMethod: z.enum(["EMAIL", "TELEGRAM"]),
  contact: z.string().min(1).max(255),
})

describe("Signup validation", () => {
  it("accepts valid email signup data", () => {
    const result = signupSchema.safeParse({
      username: "testuser",
      password: "Password123",
      authMethod: "EMAIL" as const,
      contact: "test@example.com",
    })
    expect(result.success).toBe(true)
  })

  it("rejects short username", () => {
    const result = signupSchema.safeParse({
      username: "ab",
      password: "Password123",
      authMethod: "EMAIL" as const,
      contact: "test@example.com",
    })
    expect(result.success).toBe(false)
  })

  it("rejects password without number", () => {
    const result = signupSchema.safeParse({
      username: "testuser",
      password: "password",
      authMethod: "EMAIL" as const,
      contact: "test@example.com",
    })
    expect(result.success).toBe(false)
  })

  it("rejects uppercase in username", () => {
    const result = signupSchema.safeParse({
      username: "TestUser",
      password: "Password123",
      authMethod: "EMAIL" as const,
      contact: "test@example.com",
    })
    expect(result.success).toBe(false)
  })
})