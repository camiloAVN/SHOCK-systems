import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { HeroSpotlight } from './HeroSpotlight'
import { eventTypes, heroImage } from './site-content'

const eqBars = [0.55, 0.8, 0.45, 1, 0.7, 0.9, 0.5, 0.75, 0.95, 0.6, 0.85, 0.4, 0.7, 0.55]

export function Hero() {
  return (
    <section className="hero">
      {heroImage.src && (
        <Image src={heroImage.src} alt={heroImage.alt} fill priority sizes="100vw" className="hero-photo" />
      )}

      <div className="hero-dots" aria-hidden="true" />
      <HeroSpotlight />

      <div className="hero-beams" aria-hidden="true">
        <span className="hero-beam" />
        <span className="hero-beam" />
        <span className="hero-beam" />
      </div>
      <div className="hero-scan" aria-hidden="true" />

      <div className="hero-eq" aria-hidden="true">
        {eqBars.map((height, index) => (
          <span
            key={index}
            style={
              {
                '--h': height,
                '--d': `${0.5 + (index % 5) * 0.13}s`,
                '--o': `${index * -0.17}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="wrap hero-body">
        <h1 className="title-xl">
          Energía que se ve, <br className="hero-br" />
          se escucha
          <br />
          <span className="glitch" data-text="y se siente">
            y se siente
          </span>
        </h1>
        <p className="lead">
          Producción audiovisual, renta y venta de equipos, y agencia creativa para
          conciertos, eventos masivos y corporativos.
        </p>
        <div className="hero-actions">
          <Link href="/contacto" className="btn btn-primary">
            Cotizar mi evento
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link href="/soluciones" className="link-arrow">
            Ver soluciones
          </Link>
        </div>
      </div>

      <div className="ticker">
        <div className="ticker-track">
          <ul className="ticker-list">
            {eventTypes.map((type) => (
              <li key={type}>{type}</li>
            ))}
          </ul>
          <ul className="ticker-list" aria-hidden="true">
            {eventTypes.map((type) => (
              <li key={type}>{type}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
