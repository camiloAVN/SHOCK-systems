import { CtaBand } from '@/components/public/CtaBand'
import { Hero } from '@/components/public/Hero'
import { ImageSlot } from '@/components/public/ImageSlot'
import { eventShowcase, services } from '@/components/public/site-content'
import { ArrowRight } from 'lucide-react'
import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: { absolute: 'SHOCK Producciones - Audiovisuales, equipos y eventos' },
  description:
    'Producción audiovisual, renta y venta de equipos, y agencia creativa para conciertos, eventos masivos y corporativos.',
}

const reasons = [
  {
    title: 'Un solo equipo',
    text: 'Creatividad, técnica y logística trabajan juntas, así que hablas con una sola persona de principio a fin.',
  },
  {
    title: 'Inventario con RFID',
    text: 'Identificamos y rastreamos nuestros equipos con RFID, para saber dónde está cada uno y qué sale a tu evento.',
  },
  {
    title: 'Rentar o comprar',
    text: 'Si lo necesitas para una fecha, te lo rentamos. Si lo usas todo el año, te lo vendemos.',
  },
]

export default function InicioPage() {
  return (
    <div>
      <Hero />

      {/* Services */}
      <section className="section">
        <div className="wrap">
          <div className="section-head" data-reveal>
            <h2 className="title-lg">
              Cuatro canales, <span className="accent">un solo show</span>
            </h2>
            <p className="lead">
              Toma solo lo que necesitas o déjanos el evento completo.
            </p>
          </div>

          <ol className="console" data-reveal>
            {services.map((service, index) => (
              <li key={service.id}>
                <Link href={`/soluciones#${service.id}`} className="channel">
                  <span className="fader" aria-hidden="true">
                    <span
                      className="fader-knob"
                      style={{ '--level': service.level } as React.CSSProperties}
                    />
                  </span>
                  <span className="channel-id">CH {String(index + 1).padStart(2, '0')}</span>
                  <h3 className="title-md">{service.title}</h3>
                  <p>{service.summary}</p>
                  <span className="channel-more">
                    Ver más
                    <ArrowRight aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Event types */}
      <section className="section">
        <div className="wrap">
          <div className="section-head" data-reveal>
            <h2 className="title-lg">
              Del auditorio <span className="accent">al estadio</span>
            </h2>
            <p className="lead">
              Ajustamos la producción al tamaño de tu público y de tu idea.
            </p>
          </div>

          <div className="bento">
            {eventShowcase.map((event) => (
              <article key={event.title} className={`bento-item ${event.layout}`} data-reveal>
                <ImageSlot image={event.image} sizes={event.sizes} />
                <div className="bento-text">
                  <h3 className="title-md">{event.title}</h3>
                  <p>{event.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="nosotros" className="section">
        <div className="wrap about">
          <div data-reveal>
            <h2 className="title-lg">
              Lo técnico se resuelve.
              <br />
              <span className="accent">Lo memorable se diseña.</span>
            </h2>
          </div>
          <ul className="about-list" data-reveal>
            {reasons.map((reason) => (
              <li key={reason.title}>
                <h3 className="title-md">{reason.title}</h3>
                <p>{reason.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand />
    </div>
  )
}
