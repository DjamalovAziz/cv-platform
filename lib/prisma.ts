import { PrismaClient } from "@prisma/client"
import { logger } from "./logger"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const TRANSACTION_TIMEOUT = 10_000

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    transactionOptions: { timeout: TRANSACTION_TIMEOUT },
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

prisma.$connect().catch((err) => {
  logger.error({ err }, "Failed to connect to database")
})
