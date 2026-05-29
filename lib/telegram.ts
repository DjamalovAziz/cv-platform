import { Bot, webhookCallback } from "grammy"
import { redis, RedisKeys, TTL } from "./redis"
import { logger } from "./logger"

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is required")
}

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN)

bot.command("start", async (ctx) => {
  const payload = ctx.match

  // Registration flow: /start reg_{pendingId}
  if (payload?.startsWith("reg_")) {
    const pendingId = payload.slice(4)

    const raw = await redis.get<string>(RedisKeys.pendingReg(pendingId))
    if (!raw) {
      return ctx.reply(
        "⏰ Ссылка устарела. Пожалуйста, зарегистрируйтесь заново на сайте."
      )
    }

    const data = JSON.parse(raw)
    const code = String(Math.floor(1000 + Math.random() * 9000))
    const ttl = await redis.ttl(RedisKeys.pendingReg(pendingId))

    // Update pending_reg with telegramChatId + new code
    await redis.del(RedisKeys.code(pendingId))
    await redis.set(RedisKeys.code(pendingId), code, { ex: TTL.CODE })
    await redis.set(
      RedisKeys.pendingReg(pendingId),
      JSON.stringify({ ...data, telegramChatId: ctx.chat.id }),
      { ex: Math.max(ttl, 1) }
    )

    await ctx.reply(
      `✅ Ваш код подтверждения:\n\n*${code}*\n\nДействителен 5 минут. Введите его на сайте.`,
      { parse_mode: "Markdown" }
    )
    return
  }

  // Password reset flow: /start reset_{resetToken}
  if (payload?.startsWith("reset_")) {
    const resetToken = payload.slice(6)

    const raw = await redis.get<string>(RedisKeys.resetToken(resetToken))
    if (!raw) {
      return ctx.reply(
        "⏰ Ссылка устарела. Запросите сброс пароля заново на сайте."
      )
    }

    const { code } = JSON.parse(raw)
    await ctx.reply(
      `🔑 Ваш код сброса пароля:\n\n*${code}*\n\nДействителен 10 минут. Введите его на сайте.`,
      { parse_mode: "Markdown" }
    )
    return
  }

  // Default welcome
  await ctx.reply(
    "👋 Привет! Я бот CV Platform.\n\n" +
    "Используйте ссылку с сайта для подтверждения регистрации или сброса пароля."
  )
})

bot.catch((err) => {
  logger.error({ err }, "Telegram bot error")
})

export const handleTelegramWebhook = webhookCallback(bot, "std/http")

export async function sendTelegramResetDeepLink(
  chatId: number,
  resetToken: string
): Promise<void> {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME
  const link = `https://t.me/${botUsername}?start=reset_${resetToken}`

  await bot.api.sendMessage(
    chatId,
    `🔑 Нажмите кнопку ниже для получения кода сброса пароля:`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: "Получить код", url: link }]],
      },
    }
  )
}
