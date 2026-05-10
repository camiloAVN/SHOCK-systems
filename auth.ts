import NextAuth, { type DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db/prisma"
import { compare } from "bcrypt"
import { checkRateLimit, resetRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rate-limiter"

// ── Type augmentation ────────────────────────────────────────────────────────

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      isActive: boolean
    } & DefaultSession["user"]
  }
  interface User {
    role?: string
    isActive?: boolean
  }
}

// ── Auth configuration ───────────────────────────────────────────────────────

const isProd = process.env.NODE_ENV === 'production'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,    // 8 h
    updateAge: 60 * 60,     // refresh cada 1 h
  },
  cookies: {
    sessionToken: {
      name: isProd ? '__Secure-authjs.session-token' : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: isProd,
      },
    },
    callbackUrl: {
      name: isProd ? '__Secure-authjs.callback-url' : 'authjs.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: isProd,
      },
    },
    csrfToken: {
      name: isProd ? '__Host-authjs.csrf-token' : 'authjs.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: isProd,
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
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
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
        token.role = user.role
        token.isActive = user.isActive
        token.iat = Math.floor(Date.now() / 1000)
      }

      // Expiración absoluta: 24 h desde emisión
      const tokenAge = Math.floor(Date.now() / 1000) - ((token.iat as number) || 0)
      if (tokenAge > 24 * 60 * 60) {
        console.warn(`[SECURITY] Token expired for user: ${token.email}`)
        return { ...token, expired: true }
      }

      return token
    },
    async session({ session, token }) {
      if (token.expired) {
        return { ...session, user: undefined, expires: new Date(0).toISOString() }
      }

      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string | null
        session.user.image = token.picture as string | null
        session.user.role = token.role as string
        session.user.isActive = token.isActive as boolean
      }
      return session
    },
    async signIn({ user }) {
      return !!user?.email
    },
  },
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
