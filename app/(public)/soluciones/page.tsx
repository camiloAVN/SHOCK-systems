import { CtaBand } from '@/components/public/CtaBand'
import { ImageSlot } from '@/components/public/ImageSlot'
import { processSteps, projectGallery, services } from '@/components/public/site-content'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Soluciones - SHOCK Producciones' },
  description:
    'Renta y venta de equipos audiovisuales, producción técnica y agencia creativa para eventos.',
}

export default function SolucionesPage() {
  return (
    <div>
      {/* Header */}
      <section className="page-head">
        <div className="wrap">
          <h1 className="title-xl">
            Todo lo que tu evento <span className="accent">necesita</span>
          </h1>
          <p className="lead">
            Renta, venta, producción y creatividad. Contrata una parte o el evento completo.
          </p>
        </div>
      </section>

      {/* Services */}
      <div className="wrap">
        {services.map((service) => (
          <section key={service.id} id={service.id} className="service">
            <div data-reveal>
              <ImageSlot image={service.image} sizes="(min-width: 900px) 50vw, 100vw" />
            </div>
            <div className="service-copy" data-reveal>
              <h2 className="title-lg">{service.title}</h2>
              <p>{service.description}</p>
              <ul>
                {service.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>

      {/* Projects */}
      <section className="section">
        <div className="wrap">
          <div className="section-head" data-reveal>
            <h2 className="title-lg">
              Nuestros <span className="accent">proyectos</span>
            </h2>
            <p className="lead">Una muestra de los escenarios que hemos encendido.</p>
          </div>

          <div className="gallery">
            {projectGallery.map((project) => (
              <div key={project.image.alt} className={project.layout} data-reveal>
                <ImageSlot image={project.image} sizes="(min-width: 760px) 50vw, 100vw" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="section">
        <div className="wrap">
          <div className="section-head" data-reveal>
            <h2 className="title-lg">
              Cómo <span className="accent">trabajamos</span>
            </h2>
            <p className="lead">De la primera llamada al último cable guardado.</p>
          </div>

          <ol className="steps" data-reveal>
            {processSteps.map((step, index) => (
              <li key={step.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3 className="title-md">{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand />
    </div>
  )
}
