import Link from 'next/link'
import Image from 'next/image'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Content column — logo sits in normal flow above the card so it never
          overlaps the login box on any screen size. */}
      <div className="w-full max-w-md flex flex-col items-center py-8">
        {/* Logo */}
        <Link href="/inicio" className="mb-6 sm:mb-8 inline-flex items-center group">
          <Image
            src="/images/logo_shock.png"
            alt="SHOCK Systems"
            width={0}
            height={0}
            sizes="100vw"
            priority
            className="h-32 sm:h-40 w-auto object-contain drop-shadow-[0_0_35px_rgba(249,115,22,0.45)] transition-all duration-200 group-hover:opacity-90 group-hover:drop-shadow-[0_0_45px_rgba(249,115,22,0.6)]"
          />
        </Link>

        {/* Card */}
        <div className="w-full">{children}</div>

        {/* Back to home link */}
        <Link
          href="/inicio"
          className="mt-6 text-sm text-gray-400 hover:text-orange-400 transition-colors"
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  )
}
