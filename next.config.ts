import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development'

// Hostname del almacenamiento R2 (para next/image). Se deriva de R2_PUBLIC_URL
// en build; si es un dominio propio se agrega además del subdominio r2.dev.
function r2Hostname(): string | null {
  try {
    return process.env.R2_PUBLIC_URL
      ? new URL(process.env.R2_PUBLIC_URL).hostname
      : null
  } catch {
    return null
  }
}
const r2Host = r2Hostname()

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unsafe-eval solo en desarrollo (Next.js hot reload); eliminado en producción
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join('; ')
  }
];

const nextConfig: NextConfig = {
  // Workaround for Turbopack + native modules on Windows
  serverExternalPackages: ['@prisma/client', 'prisma', 'bcrypt'],

  // Security headers for all routes
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },

  // Disable x-powered-by header
  poweredByHeader: false,

  // Strict mode for React
  reactStrictMode: true,

  // Image optimization config
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Subdominio público de R2 (pub-xxxx.r2.dev)
      { protocol: 'https', hostname: '**.r2.dev' },
      // Dominio propio de R2 si se configura uno distinto a r2.dev
      ...(r2Host && !r2Host.endsWith('.r2.dev')
        ? [{ protocol: 'https' as const, hostname: r2Host }]
        : []),
    ],
  },
};

export default nextConfig;
