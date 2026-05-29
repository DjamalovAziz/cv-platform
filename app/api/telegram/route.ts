import { NextRequest, NextResponse } from "next/server"
import { handleTelegramWebhook } from "@/lib/telegram"

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get("x-telegram-bot-api-secret-token")
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  return handleTelegramWebhook(req)
}
