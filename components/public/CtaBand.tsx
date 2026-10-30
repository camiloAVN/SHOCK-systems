import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function CtaBand() {
  return (
    <section className="cta-band">
      <div className="wrap cta-band-row">
        <div>
          <h2 className="title-lg">¿Ya tienes fecha?</h2>
          <p>Cuéntanos qué tienes en mente y armamos tu cotización.</p>
        </div>
        <Link href="/contacto" className="btn btn-dark">
          Cotizar mi evento
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
