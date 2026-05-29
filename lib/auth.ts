import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import { prisma } from "./prisma"
import { logger, securityLogger } from "./logger"

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("INVALID_CREDENTIALS")
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        })

        if (!user) {
          securityLogger.warn({ username: credentials.username }, "Login attempt: user not found")
          throw new Error("INVALID_CREDENTIALS")
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) {
          securityLogger.warn({ username: credentials.username }, "Login attempt: wrong password")
          throw new Error("INVALID_CREDENTIALS")
        }

        if (!user.isVerified) {
          throw new Error("VERIFICATION_REQUIRED")
        }

        logger.info({ userId: user.id }, "User logged in")
        return {
          id: user.id,
          username: user.username,
          email: user.email ?? undefined,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.userId = user.id
        token.username = (user as any).username
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { updatedAt: true },
        })
        token.passwordUpdatedAt = dbUser!.updatedAt.getTime()
      }

      // Validate token on every request — invalidate if password changed
      if (token.userId) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: { updatedAt: true, isVerified: true },
          })
          if (!dbUser || !dbUser.isVerified) {
            throw new Error("USER_INVALID")
          }
          if (dbUser.updatedAt.getTime() > (token.passwordUpdatedAt as number)) {
            securityLogger.info({ userId: token.userId }, "JWT invalidated due to password change")
            throw new Error("SESSION_INVALIDATED")
          }
        } catch (err: any) {
          if (err.message === "SESSION_INVALIDATED" || err.message === "USER_INVALID") {
            throw err
          }
          // DB error — keep token alive (fail open)
          logger.error({ err }, "JWT validation DB error")
        }
      }

      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string
        session.user.username = token.username as string
      }
      return session
    },
  },
}
