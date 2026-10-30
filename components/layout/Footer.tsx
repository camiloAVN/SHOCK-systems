import Image from 'next/image'
import Link from 'next/link'
import { contact, services } from '@/components/public/site-content'

export function Footer() {
  const currentYear = new Date().getFullYear()

  const companyLinks = [
    { label: 'Nosotros', href: '/inicio#nosotros' },
    { label: 'Soluciones', href: '/soluciones' },
    { label: 'Contacto', href: '/contacto' },
    { label: 'Privacidad', href: '#' },
    { label: 'Términos', href: '#' },
  ]

  return (
    <footer className="site-footer">
      <div className="wrap site-footer-grid">
        {/* Brand */}
        <div>
          <Link href="/inicio" aria-label="SHOCK Producciones" className="inline-block">
            <Image
              src="/images/logo_shock_trim.png"
              alt=""
              width={420}
              height={174}
              className="site-footer-logo"
            />
          </Link>
          <p>
            Audiovisuales, renta y venta de equipos, y agencia creativa para eventos
            que no se olvidan.
          </p>
        </div>

        {/* Services */}
        <div>
          <h3>Servicios</h3>
          <ul>
            {services.map((service) => (
              <li key={service.id}>
                <Link href={`/soluciones#${service.id}`}>{service.title}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Company Links */}
        <div>
          <h3>Empresa</h3>
          <ul>
            {companyLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3>Contacto</h3>
          <ul>
            <li>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </li>
            <li>
              <a href={contact.phoneHref}>{contact.phone}</a>
            </li>
            <li>{contact.city}</li>
          </ul>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="site-footer-bottom">
        <div className="wrap">© {currentYear} SHOCK Producciones. Todos los derechos reservados.</div>
      </div>
    </footer>
  )
}
