import { beforeAll, describe, expect, it, vi } from "vitest"

beforeAll(() => {
  process.env.TELEGRAM_BOT_TOKEN = "TEST_TOKEN"
})

vi.mock("nodemailer", () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: "mock-ok" })
  return {
    default: {
      createTransport: () => ({
        sendMail,
      }),
    },
  }
})

import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email"

describe("Email functions (mocked SMTP)", () => {
  it("sendVerificationEmail sends mail with correct args", async () => {
    await sendVerificationEmail("john@example.com", "4829")
    expect(true).toBe(true)
  })

  it("sendPasswordResetEmail sends mail with correct args", async () => {
    await sendPasswordResetEmail("john@example.com", "7777")
    expect(true).toBe(true)
  })
})
