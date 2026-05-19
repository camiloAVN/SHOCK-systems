'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { loginSchema, LoginFormData } from '@/lib/validations/auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import toast from 'react-hot-toast'

export function LoginForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        // Check for specific error types
        if (result.error.includes('UserInactive')) {
          setError('Tu cuenta ha sido desactivada. Contacta al administrador.')
          toast.error('Cuenta desactivada')
        } else if (result.error.includes('TooManyRequests')) {
          setError('Demasiados intentos. Por favor espera unos minutos.')
          toast.error('Demasiados intentos')
        } else {
          setError('Credenciales inválidas')
          toast.error('Error al iniciar sesión')
        }
        return
      }

      toast.success('Inicio de sesión exitoso')
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Login error:', err)
      setError('Error al iniciar sesión. Por favor intenta nuevamente.')
      toast.error('Error al iniciar sesión')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      )}

      <Input
        label="Email"
        type="email"
        placeholder="correo@ejemplo.com"
        error={errors.email?.message}
        autoComplete="email"
        {...register('email')}
      />

      <Input
        label="Contraseña"
        type="password"
        placeholder="••••••••"
        error={errors.password?.message}
        autoComplete="current-password"
        {...register('password')}
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full hover-glow"
        isLoading={isSubmitting}
      >
        {isSubmitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
      </Button>

      {/* Demo credentials hint */}
      <div className="text-center">
        <p className="text-sm text-gray-400">
          ¿No tienes una cuenta?{' '}
          <span className="text-orange-400">Contacta al administrador</span>
        </p>
      </div>
    </form>
  )
}
