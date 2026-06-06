import { Resend } from "resend"
import { logger } from "./logger"

const resendApiKey = process.env.RESEND_API_KEY
const resend = resendApiKey ? new Resend(resendApiKey) : null

function codeEmailHtml(code: string, type: "registration" | "reset"): string {
  const title = type === "registration" ? "Подтверждение регистрации" : "Сброс пароля"
  const text = type === "registration"
    ? "Введите этот код для завершения регистрации:"
    : "Введите этот код для сброса пароля:"

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
          <tr>
            <td style="background:#4f46e5;padding:24px 32px">
              <p style="margin:0;color:#fff;font-size:20px;font-weight:600">CV Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px">
              <h1 style="margin:0 0 8px;font-size:22px;color:#111827">${title}</h1>
              <p style="margin:0 0 24px;color:#6b7280;font-size:15px">${text}</p>
              <div style="background:#f3f4f6;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px">
                <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#111827">${code}</span>
              </div>
              <p style="margin:0;color:#9ca3af;font-size:13px">
                Код действителен ${type === "registration" ? "5" : "10"} минут.<br>
                Если вы не запрашивали этот код, просто проигнорируйте письмо.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center">
                © 2024 CV Platform. Это автоматическое письмо — не отвечайте на него.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<void> {
  if (!resend) {
    const err = new Error("RESEND_API_KEY is not set")
    logger.error({ err, email }, "Email service not configured")
    throw err
  }
  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "CV Platform <onboarding@resend.dev>",
      to: email,
      subject: `${code} — ваш код подтверждения`,
      html: codeEmailHtml(code, "registration"),
    })
    logger.info({ email: email.replace(/(.{2})(.*)(@.*)/, "$1***$3"), result }, "Verification email sent")
  } catch (error: any) {
    logger.error({ error, email, message: error?.message, code: error?.code }, "Failed to send verification email")
    throw error
  }
}

export async function sendPasswordResetEmail(
  email: string,
  code: string
): Promise<void> {
  if (!resend) {
    logger.warn({ email }, "Email service not configured")
    return
  }
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "CV Platform <onboarding@resend.dev>",
      to: email,
      subject: `${code} — код сброса пароля`,
      html: codeEmailHtml(code, "reset"),
    })
    logger.info({ email: email.replace(/(.{2})(.*)(@.*)/, "$1***$3") }, "Reset email sent")
  } catch (error) {
    logger.error({ error }, "Failed to send reset email")
    throw error
  }
}