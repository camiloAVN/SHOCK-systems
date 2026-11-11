import { z } from 'zod'

const deviceSchema = z
  .object({
    installationId: z.string().min(8).max(128).optional(),
    platform: z.enum(['android', 'ios']).optional(),
    deviceModel: z.string().max(120).optional(),
    appVersion: z.string().max(40).optional(),
  })
  .optional()

export const mobileLoginSchema = z.object({
  email: z.string().email('Email inválido').max(100).toLowerCase(),
  password: z.string().min(1, 'La contraseña es requerida').max(128),
  device: deviceSchema,
})

export const mobileRefreshSchema = z.object({
  refreshToken: z.string().min(20, 'Refresh token inválido').max(200),
})

export type MobileLoginInput = z.infer<typeof mobileLoginSchema>
export type MobileRefreshInput = z.infer<typeof mobileRefreshSchema>
