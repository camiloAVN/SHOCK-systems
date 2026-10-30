import { ContactForm } from '@/components/forms/ContactForm'
import { contact, faqs } from '@/components/public/site-content'
import { Metadata } from 'next'
import { Mail, Phone, MapPin, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: { absolute: 'Contacto - SHOCK Producciones' },
  description:
    'Cuéntanos sobre tu evento y recibe una cotización de SHOCK Producciones.',
}

export default function ContactoPage() {
  const contactInfo = [
    { icon: Mail, title: 'Email', value: contact.email, link: `mailto:${contact.email}` },
    { icon: Phone, title: 'Teléfono', value: contact.phone, link: contact.phoneHref },
    { icon: MapPin, title: 'Ubicación', value: contact.city, link: null },
    { icon: Clock, title: 'Horario', value: contact.hours, link: null },
  ]

  return (
    <div>
      {/* Header */}
      <section className="page-head">
        <div className="wrap">
          <h1 className="title-xl">
            Hablemos de <span className="accent">tu evento</span>
          </h1>
          <p className="lead">
            Cuéntanos la fecha, el lugar y lo que imaginas. Respondemos en menos de 24 horas
            y la cotización es sin compromiso.
          </p>
        </div>
      </section>

      <div className="wrap">
        <div className="contact">
          {/* Contact Information */}
          <ul className="contact-info">
            {contactInfo.map((info) => (
              <li key={info.title}>
                <info.icon aria-hidden="true" />
                <div>
                  <small>{info.title}</small>
                  {info.link ? <a href={info.link}>{info.value}</a> : <span>{info.value}</span>}
                </div>
              </li>
            ))}
          </ul>

          {/* Contact Form */}
          <div className="contact-form">
            <ContactForm />
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="title-lg">
              Preguntas <span className="accent">frecuentes</span>
            </h2>
          </div>

          <div className="faq">
            {faqs.map((faq) => (
              <details key={faq.q}>
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
