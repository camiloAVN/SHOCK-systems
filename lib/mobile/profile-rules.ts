import { z } from 'zod'

/** Reglas puras del perfil del empleado (sin Prisma, para probarlas). Ver profile.ts. */

const MIN_AGE = 14
const MAX_AGE = 100

/** Fecha de hoy en Bogotá (UTC-5 fijo, sin horario de verano) como AAAA-MM-DD */
export function todayInBogota(now: Date): string {
  return new Date(now.getTime() - 5 * 3_600_000).toISOString().slice(0, 10)
}

/** Edad cumplida en `today` (AAAA-MM-DD) para quien nació en `birth` (AAAA-MM-DD). */
export function ageOn(birth: string, today: string): number {
  const [by, bm, bd] = birth.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

function isRealDate(value: string): boolean {
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export function profileUpdateSchema(now = new Date()) {
  const today = todayInBogota(now)
  return z.object({
    cedula: z
      .string()
      .trim()
      .regex(/^\d{5,15}$/, 'La cédula debe tener entre 5 y 15 dígitos, sin puntos ni espacios')
      .optional(),
    phone: z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s()-]/g, ''))
      .pipe(z.string().regex(/^\+?\d{7,15}$/, 'El celular debe tener entre 7 y 15 dígitos'))
      .optional(),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de nacimiento inválida')
      .refine(isRealDate, 'Fecha de nacimiento inválida')
      .refine((v) => {
        const age = ageOn(v, today)
        return age >= MIN_AGE && age <= MAX_AGE
      }, `La fecha de nacimiento no es válida (edad entre ${MIN_AGE} y ${MAX_AGE} años)`)
      .optional(),
  })
}

export type ProfileUpdate = z.infer<ReturnType<typeof profileUpdateSchema>>

/** ¿Tiene los datos que se piden al empezar? */
export function isProfileComplete(user: { cedula: string | null; phone: string | null; birthDate: Date | null }): boolean {
  return !!user.cedula && !!user.phone && !!user.birthDate
}

