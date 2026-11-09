import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { requireActiveUser, requireSuperAdmin } from '@/lib/auth/check-permission'
import { teamSchema } from '@/lib/validations/team'
import { createAuditLog, getRequestClientInfo } from '@/lib/audit/log'
import { teamInclude, emptyToNull } from '@/lib/teams/shared'

// GET /api/teams — every active user can see the teams (read only)
export async function GET() {
  const actor = await requireActiveUser()
  if (!actor.hasPermission) {
    return NextResponse.json({ error: actor.error }, { status: actor.status })
  }

  try {
    const teams = await prisma.team.findMany({
      orderBy: { name: 'asc' },
      include: teamInclude,
    })
    return NextResponse.json(teams)
  } catch (error) {
    console.error('Error fetching teams:', error)
    return NextResponse.json({ error: 'Error al obtener equipos' }, { status: 500 })
  }
}

// POST /api/teams — SUPERADMIN only
export async function POST(request: NextRequest) {
  const actor = await requireSuperAdmin()
  if (!actor.hasPermission) {
    return NextResponse.json({ error: actor.error }, { status: actor.status })
  }

  try {
    const data = teamSchema.parse(await request.json())
    const { ipAddress, userAgent } = getRequestClientInfo(request)

    // Only existing users can be added
    if (data.members.length > 0) {
      const ids = data.members.map((m) => m.userId)
      const found = await prisma.user.count({ where: { id: { in: ids } } })
      if (found !== ids.length) {
        return NextResponse.json({ error: 'Alguno de los usuarios no existe' }, { status: 400 })
      }
    }

    const team = await prisma.team.create({
      data: {
        name: data.name,
        description: emptyToNull(data.description),
        color: data.color || null,
        members: {
          create: data.members.map((m, i) => ({
            userId: m.userId,
            role: emptyToNull(m.role),
            responsibilities: emptyToNull(m.responsibilities),
            isLead: !!m.isLead,
            order: i,
          })),
        },
      },
      include: teamInclude,
    })

    await createAuditLog({
      module: 'equipo',
      action: 'TEAM_CREATED',
      entityType: 'team',
      entityId: team.id,
      description: `Equipo creado: ${team.name} (${team.members.length} miembros)`,
      metadata: { teamId: team.id, members: team.members.map((m) => m.user.id) },
      performedBy: actor.userId!,
      ipAddress,
      userAgent,
    })

    return NextResponse.json(team, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Datos inválidos', issues: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un equipo con ese nombre' }, { status: 400 })
    }
    console.error('Error creating team:', error)
    return NextResponse.json({ error: 'Error al crear el equipo' }, { status: 500 })
  }
}
