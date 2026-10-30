'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { navLinks } from '@/components/public/site-content'

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  const currentPage = (href: string) => (pathname === href ? 'page' : undefined)

  return (
    <nav className="site-nav" aria-label="Principal">
      <div className="wrap site-nav-row">
        {/* Logo */}
        <Link href="/inicio" className="site-nav-logo">
          <Image
            src="/images/logo_shock_trim.png"
            alt="SHOCK Producciones"
            width={420}
            height={174}
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="site-nav-links">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={currentPage(link.href)}
              className="site-nav-link"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="site-nav-actions">
          <Link href="/login" className="site-nav-login">
            Iniciar Sesión
          </Link>
          <Link href="/contacto" className="btn btn-primary btn-sm">
            Cotizar
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="site-nav-toggle"
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="site-nav-panel">
          <div className="wrap">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={currentPage(link.href)}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setIsMenuOpen(false)}>
              Iniciar Sesión
            </Link>
            <Link
              href="/contacto"
              onClick={() => setIsMenuOpen(false)}
              className="btn btn-primary"
            >
              Cotizar
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
