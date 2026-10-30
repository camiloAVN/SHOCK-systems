'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { contactSchema, ContactFormData } from '@/lib/validations/contact'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import toast from 'react-hot-toast'

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  })

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Error al enviar el mensaje')
      }

      setSubmitStatus({
        type: 'success',
        message: '¡Mensaje enviado con éxito! Nos pondremos en contacto contigo pronto.',
      })
      toast.success('Mensaje enviado con éxito')
      reset()
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: 'Hubo un error al enviar el mensaje. Por favor intenta nuevamente.',
      })
      toast.error('Error al enviar el mensaje')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {submitStatus && (
        <Alert variant={submitStatus.type === 'success' ? 'success' : 'error'}>
          {submitStatus.message}
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Nombre completo *"
          placeholder="Juan Pérez"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Email *"
          type="email"
          placeholder="juan@ejemplo.com"
          error={errors.email?.message}
          {...register('email')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Teléfono"
          type="tel"
          placeholder="+57 300 123 4567"
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          label="Empresa"
          placeholder="Mi Empresa S.A."
          error={errors.company?.message}
          {...register('company')}
        />
      </div>

      <Input
        label="Asunto *"
        placeholder="Solicitud de cotización"
        error={errors.subject?.message}
        {...register('subject')}
      />

      <Textarea
        label="Mensaje *"
        placeholder="Fecha, lugar, número de asistentes y lo que tienes en mente..."
        rows={6}
        error={errors.message?.message}
        {...register('message')}
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="btn btn-primary"
        isLoading={isSubmitting}
      >
        {isSubmitting ? 'Enviando...' : 'Enviar Mensaje'}
      </Button>

      <p className="text-sm text-gray-400 text-center">
        * Campos obligatorios
      </p>
    </form>
  )
}
