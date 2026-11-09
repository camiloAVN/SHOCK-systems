import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { requireActiveUser, requireSuperAdmin } from '@/lib/auth/check-permission'
import { teamSchema } from '@/lib/validations/team'
import { createAuditLog, getRequestClientInfo } from '@/lib/audit/log'
import { teamInclude, emptyToNull } from '@/lib/teams/shared'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/teams/[id] — any active user (read only)
export async function GET(_request: NextRequest, { params }: Ctx) {
  const actor = await requireActiveUser()
  if (!actor.hasPermission) {
    return NextResponse.json({ error: actor.error }, { status: actor.status })
  }
  const { id } = await params
  const team = await prisma.team.findUnique({ where: { id }, include: teamInclude })
  if (!team) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
  return NextResponse.json(team)
}

// PUT /api/teams/[id] — SUPERADMIN only. Replaces data and the full member list.
export async function PUT(request: NextRequest, { params }: Ctx) {
  const actor = await requireSuperAdmin()
  if (!actor.hasPermission) {
    return NextResponse.json({ error: actor.error }, { status: actor.status })
  }

  try {
    const { id } = await params
    const data = teamSchema.parse(await request.json())
    const { ipAddress, userAgent } = getRequestClientInfo(request)

    const existing = await prisma.team.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!existing) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

    if (data.members.length > 0) {
      const ids = data.members.map((m) => m.userId)
      const found = await prisma.user.count({ where: { id: { in: ids } } })
      if (found !== ids.length) {
        return NextResponse.json({ error: 'Alguno de los usuarios no existe' }, { status: 400 })
      }
    }

    const team = await prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { id },
        data: {
          name: data.name,
          description: emptyToNull(data.description),
          color: data.color || null,
        },
      })
      await tx.teamMember.deleteMany({ where: { teamId: id } })
      if (data.members.length > 0) {
        await tx.teamMember.createMany({
          data: data.members.map((m, i) => ({
            teamId: id,
            userId: m.userId,
            role: emptyToNull(m.role),
            responsibilities: emptyToNull(m.responsibilities),
            isLead: !!m.isLead,
            order: i,
          })),
        })
      }
      return tx.team.findUniqueOrThrow({ where: { id }, include: teamInclude })
    })

    await createAuditLog({
      module: 'equipo',
      action: 'TEAM_UPDATED',
      entityType: 'team',
      entityId: team.id,
      description: `Equipo actualizado: ${team.name} (${team.members.length} miembros)`,
      metadata: { teamId: team.id, previousName: existing.name, members: team.members.map((m) => m.user.id) },
      performedBy: actor.userId!,
      ipAddress,
      userAgent,
    })

    return NextResponse.json(team)
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
    console.error('Error updating team:', error)
    return NextResponse.json({ error: 'Error al actualizar el equipo' }, { status: 500 })
  }
}

// DELETE /api/teams/[id] — SUPERADMIN only. Users are NOT deleted, only the team and its memberships.
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const actor = await requireSuperAdmin()
  if (!actor.hasPermission) {
    return NextResponse.json({ error: actor.error }, { status: actor.status })
  }

  try {
    const { id } = await params
    const { ipAddress, userAgent } = getRequestClientInfo(request)
    const existing = await prisma.team.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!existing) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

    await prisma.team.delete({ where: { id } })

    await createAuditLog({
      module: 'equipo',
      action: 'TEAM_DELETED',
      entityType: 'team',
      entityId: id,
      description: `Equipo eliminado: ${existing.name}`,
      metadata: { teamId: id },
      performedBy: actor.userId!,
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting team:', error)
    return NextResponse.json({ error: 'Error al eliminar el equipo' }, { status: 500 })
  }
}
