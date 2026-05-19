
import { Hero } from '@/components/public/Hero'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SHOCK Systems - Control de Inventario y Alquiler de Equipos',
  description: 'Soluciones innovadoras en ingeniería robótica y desarrollo de software. Transformamos ideas en realidad tecnológica.',
}

export default function InicioPage() {
  return (
    <div>
      <Hero />

      {/* Stats Section */}
      <section className="py-20 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { number: '50+', label: 'Proyectos Completados' },
              { number: '30+', label: 'Clientes Satisfechos' },
              { number: '10+', label: 'Años de Experiencia' },
              { number: '98%', label: 'Tasa de Éxito' },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-gradient mb-2">
                  {stat.number}
                </div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Preview */}
      <section className="py-20 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Nuestros <span className="text-gradient">Servicios</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Ofrecemos soluciones completas desde la conceptualización hasta la implementación
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Ingeniería Robótica',
                description: 'Diseño y desarrollo de sistemas robóticos industriales y de servicio.',
                features: ['Automatización', 'Control de Procesos', 'Mantenimiento'],
              },
              {
                title: 'Desarrollo de Software',
                description: 'Aplicaciones web y móviles escalables y de alto rendimiento.',
                features: ['Apps Web', 'Apps Móviles', 'APIs REST'],
              },
              {
                title: 'Consultoría Técnica',
                description: 'Asesoramiento experto para optimizar tus procesos tecnológicos.',
                features: ['Auditorías', 'Optimización', 'Capacitación'],
              },
            ].map((service, index) => (
              <div
                key={index}
                className="glass p-8 rounded-xl hover:border-orange-500/40 transition-all duration-200 group"
              >
                <h3 className="text-xl font-bold text-gray-200 mb-3 group-hover:text-orange-400 transition-colors">
                  {service.title}
                </h3>
                <p className="text-gray-400 mb-4 text-sm">{service.description}</p>
                <ul className="space-y-2">
                  {service.features.map((feature, i) => (
                    <li key={i} className="text-sm text-gray-500 flex items-center">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-2" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
