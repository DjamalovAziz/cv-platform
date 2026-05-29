import { z } from "zod"
import { TRPCError } from "@trpc/server"
import bcrypt from "bcrypt"
import { createTRPCRouter, protectedProcedure } from "../trpc"
import { logger, securityLogger } from "@/lib/logger"

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        telegramId: true,
        authMethod: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { portfolios: true } },
      },
    })
    if (!user) throw new TRPCError({ code: "NOT_FOUND" })
    return user
  }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z
          .string()
          .min(8)
          .regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, "Must contain letter and number"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })

      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash)
      if (!valid) {
        securityLogger.warn({ userId: user.id }, "Failed password change attempt")
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" })
      }

      const newHash = await bcrypt.hash(input.newPassword, 10)

      // Update updatedAt — this invalidates all existing JWTs
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash, updatedAt: new Date() },
      })

      securityLogger.info({ userId: user.id }, "Password changed — all sessions invalidated")
      return { ok: true }
    }),
})
