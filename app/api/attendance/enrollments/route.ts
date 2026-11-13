import { NextRequest, NextResponse } from 'next/server'
import type { FaceEnrollmentStatus } from '@prisma/client'
import { canEditModule, canViewModule } from '@/lib/auth/check-permission'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

const FILTERS: Record<string, FaceEnrollmentStatus[]> = {
  pending: ['PENDING'],
  approved: ['APPROVED'],
  history: ['REJECTED', 'REVOKED', 'SUPERSEDED'],
}

// GET /api/attendance/enrollments?status=pending|approved|history
// Lista de registros faciales para la revisión en la web (módulo asistencia_reportes).
export async function GET(request: NextRequest) {
  const view = await canViewModule('asistencia_reportes')
  if (!view.hasPermission) return NextResponse.json({ error: view.error }, { status: view.status })

  try {
    const filter = request.nextUrl.searchParams.get('status') ?? 'pending'
    const statuses = FILTERS[filter]
    if (!statuses) return NextResponse.json({ error: 'Filtro inválido' }, { status: 400 })

    const [enrollments, canReview] = await Promise.all([
      prisma.faceEnrollment.findMany({
        where: { status: { in: statuses } },
        orderBy: { submittedAt: filter === 'pending' ? 'asc' : 'desc' },
        take: 200,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          reviewNote: true,
          livenessMethod: true,
          challengeSteps: true,
          quality: true,
          imageKey: true,
          user: { select: { id: true, name: true, email: true, cedula: true, position: true, image: true, isActive: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      canEditModule('asistencia_reportes'),
    ])

    return NextResponse.json({
      canReview: canReview.hasPermission,
      currentUserId: view.userId,
      enrollments: enrollments.map(({ imageKey, ...e }) => ({ ...e, hasPhoto: !!imageKey })),
    })
  } catch (error) {
    console.error('Error listing face enrollments:', error)
    return NextResponse.json({ error: 'Error al obtener los registros faciales' }, { status: 500 })
  }
}
