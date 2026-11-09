import { z } from 'zod'

export const teamMemberInputSchema = z.object({
  userId: z.string().min(1, 'Usuario requerido').max(64),
  role: z.string().trim().max(100, 'Máximo 100 caracteres').optional().nullable(),
  responsibilities: z.string().trim().max(2000, 'Máximo 2000 caracteres').optional().nullable(),
  isLead: z.boolean().optional().default(false),
})

export const teamSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(80, 'Máximo 80 caracteres'),
  description: z.string().trim().max(1000, 'Máximo 1000 caracteres').optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido')
    .optional()
    .nullable(),
  members: z
    .array(teamMemberInputSchema)
    .max(200)
    .refine((arr) => new Set(arr.map((m) => m.userId)).size === arr.length, 'Un usuario no puede estar dos veces en el mismo equipo')
    .default([]),
})

export type TeamFormData = z.input<typeof teamSchema>
export type TeamMemberInput = z.input<typeof teamMemberInputSchema>

export type TeamMemberView = {
  id: string
  role: string | null
  responsibilities: string | null
  isLead: boolean
  order: number
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
    position: string | null
  }
}

export type TeamView = {
  id: string
  name: string
  description: string | null
  color: string | null
  createdAt: string
  updatedAt: string
  members: TeamMemberView[]
}

export const TEAM_COLORS = ['#F5920A', '#EF4444', '#10B981', '#0EA5E9', '#8B5CF6', '#EC4899', '#EAB308', '#64748B']
