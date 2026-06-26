import type { NextAuthConfig, DefaultSession } from "next-auth"

// ── Type augmentation ────────────────────────────────────────────────────────
// Definido aquí para que esté disponible tanto en auth.ts como en middleware.ts

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

// ── Edge-compatible auth config ──────────────────────────────────────────────
// Este archivo NO puede importar bcrypt, prisma ni ningún módulo nativo de Node.
// Es usado por middleware.ts que corre en el Edge Runtime.

const isProd = process.env.NODE_ENV === 'production'

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  // Railway (y cualquier host detrás de proxy que no sea Vercel) necesita confiar
  // en el host reenviado; sin esto NextAuth v5 rechaza el login en producción.
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,  // 8 h
    updateAge: 60 * 60,   // refresh cada 1 h
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
  providers: [], // Los providers reales se agregan en auth.ts (requieren Node.js)
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: any) {
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
      const tokenAge = Math.floor(Date.now() / 1000) - (token.iat || 0)
      if (tokenAge > 24 * 60 * 60) {
        return { ...token, expired: true }
      }

      return token
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      if (token.expired) {
        return { ...session, user: undefined, expires: new Date(0).toISOString() }
      }

      if (session.user) {
        session.user.id = token.id
        session.user.email = token.email
        session.user.name = token.name
        session.user.image = token.picture
        session.user.role = token.role
        session.user.isActive = token.isActive
      }
      return session
    },
    async signIn({ user }: { user: { email?: string | null } }) {
      return !!user?.email
    },
  },
} satisfies NextAuthConfig
