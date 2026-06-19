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

describe("Signup validation schema", () => {
  const validBase = {
    username: "valid_user",
    password: "Password123",
    authMethod: "EMAIL" as const,
    contact: "user@example.com",
  }

  it.each([
    ["valid email contact", { ...validBase, contact: "user@example.com" }, true],
    ["valid telegram contact (no @ required)", { ...validBase, authMethod: "TELEGRAM" as const, contact: "john_doe" }, true],
    ["rejects username shorter than 3 chars", { ...validBase, username: "ab" }, false],
    ["rejects username longer than 30 chars", { ...validBase, username: "a".repeat(31) }, false],
    ["rejects uppercase in username", { ...validBase, username: "JohnDoe" }, false],
    ["rejects dash in username", { ...validBase, username: "john-doe" }, false],
    ["rejects dot in username", { ...validBase, username: "john.doe" }, false],
    ["rejects password with no digit", { ...validBase, password: "NoNumbers!" }, false],
    ["rejects password with no letter", { ...validBase, password: "12345678" }, false],
    ["rejects password shorter than 8", { ...validBase, password: "Ab1!" }, false],
    ["rejects empty contact", { ...validBase, contact: "" }, false],
    ["rejects undefined authMethod", { ...validBase, authMethod: "WRONG" as any }, false],
  ])("%s", (_name: string, input: any, expected: boolean) => {
    const result = signupSchema.safeParse(input)
    expect(result.success).toBe(expected)
  })
})
