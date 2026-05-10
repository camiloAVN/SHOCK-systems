'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ArrowRight, Sparkles, Zap, Target } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-6"
          >
            Transformamos Ideas en{' '}
            <span className="text-gradient">Realidad Tecnológica</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-md lg:text-xl text-gray-400 max-w-3xl mx-auto mb-10"
          >
            Soluciones innovadoras en ingeniería robótica y desarrollo de software
            para impulsar tu negocio al futuro. Experiencia, tecnología de punta y
            resultados garantizados.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/contacto">
              <Button size="lg" variant="primary" className="hover-glow group">
                Comenzar Proyecto
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/soluciones">
              <Button size="lg" variant="outline">
                Ver Soluciones
              </Button>
            </Link>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
          >
            {[
              {
                icon: Zap,
                title: 'Desarrollo Ágil',
                description: 'Metodologías modernas para entrega rápida y eficiente',
              },
              {
                icon: Target,
                title: 'Soluciones Personalizadas',
                description: 'Adaptadas a las necesidades específicas de tu negocio',
              },
              {
                icon: Sparkles,
                title: 'Tecnología de Punta',
                description: 'Herramientas y frameworks más avanzados del mercado',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="glass p-6 rounded-xl hover:border-orange-500/40 transition-all duration-200"
              >
                <feature.icon className="w-10 h-10 text-orange-400 mb-4 mx-auto" />
                <h3 className="text-lg font-semibold text-gray-200 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-400">{feature.description}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
