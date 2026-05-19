import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Logo */}
      <Link href="/inicio" className="absolute top-8 left-8 flex items-center space-x-2 group">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg group-hover:shadow-orange-500/50 transition-shadow duration-200">
          <span className="text-white font-bold text-xl">S</span>
        </div>
        <span className="text-xl font-bold text-gradient">SHOCK</span>
      </Link>

      {/* Content */}
      <div className="w-full max-w-md">
        {children}
      </div>

      {/* Back to home link */}
      <Link
        href="/inicio"
        className="absolute bottom-8 text-sm text-gray-400 hover:text-orange-400 transition-colors"
      >
        ← Volver al inicio
      </Link>
    </div>
  )
}
