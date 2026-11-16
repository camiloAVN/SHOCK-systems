import { z } from 'zod'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { validateShifts } from '@/lib/attendance/shifts'

const { minAreaRadiusMeters, maxAreaRadiusMeters } = ATTENDANCE_CONFIG.geo

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} no puede exceder ${max} caracteres`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))

/** Área de asistencia (crear y editar; la web siempre envía el objeto completo). */
export const attendanceAreaSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'El nombre no puede exceder 100 caracteres'),
  description: optionalText(500, 'La descripción'),
  latitude: z.number({ message: 'Ubica el centro del área en el mapa' }).min(-90).max(90),
  longitude: z.number({ message: 'Ubica el centro del área en el mapa' }).min(-180).max(180),
  radiusMeters: z
    .number({ message: 'Indica el radio en metros' })
    .int('El radio debe ser un número entero de metros')
    .min(minAreaRadiusMeters, `El radio mínimo es ${minAreaRadiusMeters} m (precisión típica del GPS)`)
    .max(maxAreaRadiusMeters, `El radio máximo es ${maxAreaRadiusMeters} m`),
  isActive: z.boolean().default(true),
  projectId: z.string().min(1).optional().nullable().transform((v) => v ?? null),
})
export type AttendanceAreaInput = z.infer<typeof attendanceAreaSchema>

const shiftSchema = z.object({
  /** Id de un turno existente (al editar): se conserva en vez de recrearlo */
  id: z.string().min(1).optional(),
  startsAt: z.iso.datetime({ offset: true, message: 'Fecha de inicio inválida' }).transform((v) => new Date(v)),
  endsAt: z.iso.datetime({ offset: true, message: 'Fecha de fin inválida' }).transform((v) => new Date(v)),
})

/** Asignación de un área a UNA persona o a UN equipo, con sus turnos (se reemplazan completos al editar). */
export const attendanceAssignmentSchema = z
  .object({
    userId: z.string().min(1).optional().nullable(),
    teamId: z.string().min(1).optional().nullable(),
    notes: optionalText(500, 'Las notas'),
    shifts: z.array(shiftSchema),
  })
  .superRefine((value, ctx) => {
    if (!value.userId === !value.teamId) {
      ctx.addIssue({ code: 'custom', path: ['userId'], message: 'Elige una persona o un equipo (solo uno)' })
    }
    // Zod 4 corre este refinamiento aunque alguna fecha ya haya fallado: validar solo si todas son fechas
    const allDates = Array.isArray(value.shifts) && value.shifts.every((s) => s?.startsAt instanceof Date && s?.endsAt instanceof Date)
    if (!allDates) return
    const problem = validateShifts(value.shifts)
    if (problem) ctx.addIssue({ code: 'custom', path: ['shifts'], message: problem })
  })
export type AttendanceAssignmentInput = z.infer<typeof attendanceAssignmentSchema>
