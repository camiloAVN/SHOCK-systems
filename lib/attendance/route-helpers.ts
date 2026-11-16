import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { createAuditLog, getRequestClientInfo } from '@/lib/audit/log'
import { AreaError } from '@/lib/attendance/areas'

/** Respuesta de error común de las rutas web de áreas: validación 400, AreaError con su estado, resto 500. */
export function areaErrorResponse(error: unknown, context: string) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
  }
  if (error instanceof AreaError) return NextResponse.json({ error: error.message }, { status: error.status })
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'El cuerpo debe ser JSON válido' }, { status: 400 })
  console.error(`[ASISTENCIA] ${context}:`, error)
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
}

/** Bitácora del módulo asistencia_areas. */
export async function auditAreas(
  request: NextRequest,
  performedBy: string,
  entry: { action: string; entityType: 'attendance_area' | 'attendance_assignment'; entityId: string; description: string; metadata?: Prisma.InputJsonValue }
) {
  const { ipAddress, userAgent } = getRequestClientInfo(request)
  await createAuditLog({ module: 'asistencia_areas', performedBy, ipAddress, userAgent, ...entry })
}
