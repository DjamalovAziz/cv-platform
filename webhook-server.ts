import { createServer } from "node:http"
import { handleTelegramWebhook } from "./lib/telegram"

const PORT = process.env.PORT ?? 3001

const server = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/webhook") {
    try {
      const update = await new Promise<any>((resolve, reject) => {
        const chunks: Uint8Array[] = []
        req.on("data", (chunk: Uint8Array) => chunks.push(chunk))
        req.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")))
          } catch (e) {
            reject(e)
          }
        })
        req.on("error", reject)
      })

      await handleTelegramWebhook(update)

      if (!res.writableEnded) {
        res.writeHead(200, { "content-type": "text/plain" })
        res.end("OK")
      }
    } catch (err) {
      console.error("Webhook error", err)
      if (!res.writableEnded) {
        res.writeHead(200, { "content-type": "text/plain" })
        res.end("OK")
      }
    }
    return
  }

  res.writeHead(200, { "content-type": "text/plain" })
  res.end("OK")
})

server.listen(PORT, () => {
  console.log(`Telegram bot webhook listening on ${PORT}`)
})
