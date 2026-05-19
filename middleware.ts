import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"
import { NextResponse } from "next/server"

// Instancia edge-compatible: solo usa authConfig (sin bcrypt ni Prisma)
const { auth } = NextAuth(authConfig)

const PUBLIC_API_PREFIXES = ['/api/auth', '/api/contact', '/api/health']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth

  const isProtectedApi =
    pathname.startsWith('/api/') &&
    !PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))

  // CSRF: rechazar peticiones mutantes con Origin externo
  if (isProtectedApi && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.get('origin')
    if (origin) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      if (origin !== appUrl) {
        console.warn(`[SECURITY] CSRF blocked: origin=${origin} path=${pathname}`)
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }

  // Proteger APIs privadas
  if (isProtectedApi && !isAuthenticated) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Proteger rutas del dashboard
  if (pathname.startsWith('/dashboard') && !isAuthenticated) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirigir usuarios autenticados fuera del login
  if (pathname === '/login' && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
