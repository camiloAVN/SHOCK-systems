import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db/prisma"
import { compare } from "bcrypt"
import { checkRateLimit, resetRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rate-limiter"
import { authConfig } from "@/auth.config"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = (credentials.email as string).toLowerCase()

        const rateLimitResult = checkRateLimit(
          `auth:${email}`,
          RATE_LIMIT_CONFIGS.login
        )

        if (!rateLimitResult.success) {
          console.warn(`[SECURITY] Rate limit exceeded for auth: ${email}`)
          throw new Error("TooManyRequests")
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            image: true,
            role: true,
            isActive: true,
          },
        })

        if (!user || !user.password) {
          // Comparación en tiempo constante para prevenir timing attacks
          await compare(
            credentials.password as string,
            "$2b$12$invalidhashtopreventtimingattacks"
          )
          return null
        }

        if (!user.isActive) {
          console.warn(`[SECURITY] Inactive user attempted login: ${email}`)
          throw new Error("UserInactive")
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          console.warn(`[SECURITY] Invalid password attempt for: ${email}`)
          return null
        }

        resetRateLimit(`auth:${email}`)
        console.info(`[AUTH] User authenticated: ${email}`)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          isActive: user.isActive,
        }
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      console.info(`[AUTH] Sign in event: ${user.email}`)
    },
    async signOut(message) {
      if ('token' in message) {
        console.info(`[AUTH] Sign out event: ${message.token?.email}`)
      }
    },
  },
})
