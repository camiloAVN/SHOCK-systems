import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { visibleShifts, visibleShiftsRange } from '@/lib/attendance/shifts'
import type { AttendanceAreaInput, AttendanceAssignmentInput } from '@/lib/validations/attendance'

/**
 * Áreas de asistencia, asignaciones y turnos (Fase 5). Las rutas de la web y de la app
 * llaman a estas funciones; los permisos se comprueban en las rutas.
 */

export class AreaError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

/** URL del estilo del mapa (OpenFreeMap por defecto). Cambiar de proveedor = cambiar MAP_STYLE_URL. */
export function mapStyleUrl(): string {
  return process.env.MAP_STYLE_URL || ATTENDANCE_CONFIG.map.defaultStyleUrl
}

const personSelect = { id: true, name: true, email: true, cedula: true, position: true, image: true, isActive: true } as const

const assignmentInclude = {
  user: { select: personSelect },
  team: { select: { id: true, name: true, color: true, _count: { select: { members: true } } } },
  shifts: { orderBy: { startsAt: 'asc' } },
} satisfies Prisma.AttendanceAssignmentInclude

const areaSummarySelect = {
  id: true,
  name: true,
  description: true,
  latitude: true,
  longitude: true,
  radiusMeters: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, title: true, status: true } },
} satisfies Prisma.AttendanceAreaSelect

/** Lista de áreas con cuántas asignaciones tienen y su próximo turno. */
export async function listAreas(now = new Date()) {
  const { endsAtFrom } = visibleShiftsRange(now)
  const areas = await prisma.attendanceArea.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select: {
      ...areaSummarySelect,
      _count: { select: { assignments: true } },
      assignments: {
        select: { shifts: { where: { endsAt: { gte: endsAtFrom } }, orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true, endsAt: true } } },
      },
    },
  })
  return areas.map(({ assignments, _count, ...area }) => {
    const next = assignments
      .flatMap((a) => a.shifts)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0]
    return { ...area, assignmentCount: _count.assignments, nextShift: next ?? null }
  })
}

export async function getAreaDetail(id: string) {
  const area = await prisma.attendanceArea.findUnique({
    where: { id },
    select: {
      ...areaSummarySelect,
      createdBy: { select: { id: true, name: true, email: true } },
      assignments: { orderBy: { createdAt: 'asc' }, include: assignmentInclude },
    },
  })
  if (!area) throw new AreaError(404, 'Área no encontrada')
  return area
}

async function assertProject(projectId: string | null) {
  if (!projectId) return
  const exists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
  if (!exists) throw new AreaError(400, 'El proyecto elegido no existe')
}

export async function createArea(input: AttendanceAreaInput, createdById: string) {
  await assertProject(input.projectId)
  return prisma.attendanceArea.create({ data: { ...input, createdById }, select: areaSummarySelect })
}

export async function updateArea(id: string, input: AttendanceAreaInput) {
  const before = await prisma.attendanceArea.findUnique({ where: { id }, select: areaSummarySelect })
  if (!before) throw new AreaError(404, 'Área no encontrada')
  await assertProject(input.projectId)
  const after = await prisma.attendanceArea.update({ where: { id }, data: input, select: areaSummarySelect })
  return { before, after }
}

export async function deleteArea(id: string) {
  const area = await prisma.attendanceArea.findUnique({ where: { id }, select: { id: true, name: true, _count: { select: { assignments: true } } } })
  if (!area) throw new AreaError(404, 'Área no encontrada')
  await prisma.attendanceArea.delete({ where: { id } })
  return area
}

/** La persona debe existir y estar activa; el equipo, existir. */
async function assertTarget(input: Pick<AttendanceAssignmentInput, 'userId' | 'teamId'>) {
  if (input.userId) {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { isActive: true } })
    if (!user) throw new AreaError(400, 'La persona elegida no existe')
    if (!user.isActive) throw new AreaError(400, 'La persona elegida está desactivada')
  }
  if (input.teamId) {
    const team = await prisma.team.findUnique({ where: { id: input.teamId }, select: { id: true } })
    if (!team) throw new AreaError(400, 'El equipo elegido no existe')
  }
}

export async function createAssignment(areaId: string, input: AttendanceAssignmentInput, createdById: string) {
  const area = await prisma.attendanceArea.findUnique({ where: { id: areaId }, select: { id: true, name: true } })
  if (!area) throw new AreaError(404, 'Área no encontrada')
  await assertTarget(input)
  const assignment = await prisma.attendanceAssignment.create({
    data: {
      areaId,
      userId: input.userId ?? null,
      teamId: input.teamId ?? null,
      notes: input.notes,
      createdById,
      shifts: { create: input.shifts.map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt })) },
    },
    include: assignmentInclude,
  })
  return { area, assignment }
}

/**
 * Edita destino, notas y turnos en una transacción. Los turnos que llegan con `id` se conservan
 * (y se actualizan si cambió la hora); los nuevos se crean; los que ya no vienen se borran.
 * Conservar los ids importa: las marcaciones (Fase 6) se asocian al turno.
 */
export async function updateAssignment(id: string, input: AttendanceAssignmentInput) {
  const before = await prisma.attendanceAssignment.findUnique({
    where: { id },
    include: { area: { select: { id: true, name: true } }, shifts: { select: { id: true, startsAt: true, endsAt: true } } },
  })
  if (!before) throw new AreaError(404, 'Asignación no encontrada')
  await assertTarget(input)

  const existing = new Map(before.shifts.map((s) => [s.id, s]))
  for (const s of input.shifts) {
    if (s.id && !existing.has(s.id)) throw new AreaError(400, 'Uno de los turnos no pertenece a esta asignación')
  }
  const keep = new Set(input.shifts.flatMap((s) => (s.id ? [s.id] : [])))
  const changed = input.shifts.filter((s) => {
    const old = s.id ? existing.get(s.id) : undefined
    return old && (old.startsAt.getTime() !== s.startsAt.getTime() || old.endsAt.getTime() !== s.endsAt.getTime())
  })

  const assignment = await prisma.$transaction(async (tx) => {
    await tx.attendanceShift.deleteMany({ where: { assignmentId: id, id: { notIn: [...keep] } } })
    for (const s of changed) await tx.attendanceShift.update({ where: { id: s.id }, data: { startsAt: s.startsAt, endsAt: s.endsAt } })
    return tx.attendanceAssignment.update({
      where: { id },
      data: {
        userId: input.userId ?? null,
        teamId: input.teamId ?? null,
        notes: input.notes,
        shifts: { create: input.shifts.filter((s) => !s.id).map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt })) },
      },
      include: assignmentInclude,
    })
  })
  return { area: before.area, assignment, removedShifts: before.shifts.length - keep.size }
}

export async function deleteAssignment(id: string) {
  const assignment = await prisma.attendanceAssignment.findUnique({
    where: { id },
    include: { area: { select: { id: true, name: true } }, user: { select: { email: true } }, team: { select: { name: true } } },
  })
  if (!assignment) throw new AreaError(404, 'Asignación no encontrada')
  await prisma.attendanceAssignment.delete({ where: { id } })
  return assignment
}

/** Datos para los selectores del formulario de asignación. */
export async function assignmentOptions() {
  const [users, teams, projects] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, orderBy: [{ name: 'asc' }, { email: 'asc' }], select: { id: true, name: true, email: true, cedula: true, position: true } }),
    prisma.team.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, color: true, _count: { select: { members: true } } } }),
    prisma.project.findMany({
      where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      orderBy: { updatedAt: 'desc' },
      take: 300,
      select: { id: true, title: true, status: true, client: { select: { name: true } } },
    }),
  ])
  return { users, teams, projects }
}

/**
 * Asignaciones del empleado para la app: las suyas directas y las de los equipos a los que
 * pertenece HOY, solo áreas activas, con los turnos abiertos y próximos.
 */
export async function myAssignments(userId: string, now = new Date()) {
  const { endsAtFrom, startsAtTo } = visibleShiftsRange(now)
  const memberships = await prisma.teamMember.findMany({ where: { userId }, select: { teamId: true } })
  const rows = await prisma.attendanceAssignment.findMany({
    where: {
      area: { isActive: true },
      OR: [{ userId }, ...(memberships.length ? [{ teamId: { in: memberships.map((m) => m.teamId) } }] : [])],
      shifts: { some: { endsAt: { gte: endsAtFrom }, startsAt: { lte: startsAtTo } } },
    },
    select: {
      id: true,
      notes: true,
      team: { select: { id: true, name: true } },
      area: { select: { id: true, name: true, description: true, latitude: true, longitude: true, radiusMeters: true, project: { select: { title: true } } } },
      shifts: {
        where: { endsAt: { gte: endsAtFrom }, startsAt: { lte: startsAtTo } },
        orderBy: { startsAt: 'asc' },
        select: { id: true, startsAt: true, endsAt: true },
      },
    },
  })

  return rows
    .map((row) => ({ row, shifts: visibleShifts(row.shifts, now) }))
    .filter(({ shifts }) => shifts.length > 0)
    .sort((a, b) => a.shifts[0].startsAt.getTime() - b.shifts[0].startsAt.getTime())
    .map(({ row, shifts }) => ({
      assignmentId: row.id,
      via: row.team ? { type: 'team' as const, teamId: row.team.id, teamName: row.team.name } : { type: 'user' as const },
      notes: row.notes,
      area: {
        id: row.area.id,
        name: row.area.name,
        description: row.area.description,
        latitude: row.area.latitude,
        longitude: row.area.longitude,
        radiusMeters: row.area.radiusMeters,
        projectTitle: row.area.project?.title ?? null,
      },
      shifts: shifts.map((s) => ({
        id: s.id,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        opensAt: s.opensAt.toISOString(),
        closesAt: s.closesAt.toISOString(),
        phase: s.phase,
      })),
    }))
}
