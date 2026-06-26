import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { canViewModule, canEditModule } from '@/lib/auth/check-permission'
import {
  locationSchema,
  allowedChildTypes,
  normalizeCode,
  LocationType,
  LocationNode,
  Location,
  LOCATION_PATH_SEPARATOR,
} from '@/lib/validations/location'
import { ZodError } from 'zod'

// GET /api/locations - Devuelve el árbol anidado de ubicaciones
export async function GET() {
  try {
    const permissionCheck = await canViewModule('ubicaciones')
    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      )
    }

    const locations = await prisma.location.findMany({
      include: {
        _count: {
          select: { items: true, children: true },
        },
      },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    })

    // Construir el árbol anidado en memoria
    const nodeMap = new Map<string, LocationNode>()
    const roots: LocationNode[] = []

    for (const loc of locations) {
      nodeMap.set(loc.id, { ...(loc as unknown as Location), children: [] })
    }

    for (const loc of locations) {
      const node = nodeMap.get(loc.id)!
      if (loc.parentId && nodeMap.has(loc.parentId)) {
        nodeMap.get(loc.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    // Ordenar hijos por código de forma natural (numérica cuando aplica)
    const sortChildren = (nodes: LocationNode[]) => {
      nodes.sort((a, b) =>
        a.code.localeCompare(b.code, undefined, { numeric: true })
      )
      nodes.forEach((n) => sortChildren(n.children))
    }
    sortChildren(roots)

    return NextResponse.json(roots)
  } catch (error) {
    console.error('Error fetching locations:', error)
    return NextResponse.json(
      { error: 'Error al obtener ubicaciones' },
      { status: 500 }
    )
  }
}

// POST /api/locations - Crear un nodo de ubicación
export async function POST(request: NextRequest) {
  try {
    const permissionCheck = await canEditModule('ubicaciones')
    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      )
    }

    const body = await request.json()
    const validatedData = locationSchema.parse(body)

    const type = validatedData.type as LocationType
    const code = normalizeCode(type, validatedData.code)
    const parentId = validatedData.parentId || null

    let fullPath = code

    if (parentId) {
      const parent = await prisma.location.findUnique({ where: { id: parentId } })
      if (!parent) {
        return NextResponse.json(
          { error: 'La ubicación padre no existe' },
          { status: 404 }
        )
      }

      const allowed = allowedChildTypes(parent.type as LocationType)
      if (!allowed.includes(type)) {
        return NextResponse.json(
          { error: `Un ${parent.type} no puede contener un ${type}` },
          { status: 400 }
        )
      }

      fullPath = `${parent.fullPath}${LOCATION_PATH_SEPARATOR}${code}`
    } else if (type !== 'SECTOR') {
      return NextResponse.json(
        { error: 'Las ubicaciones raíz deben ser de tipo Sector' },
        { status: 400 }
      )
    }

    const location = await prisma.location.create({
      data: {
        type,
        code,
        description: validatedData.description || null,
        parentId,
        fullPath,
      },
      include: {
        _count: { select: { items: true, children: true } },
      },
    })

    return NextResponse.json({ ...location, children: [] }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Ya existe una ubicación con ese código en este nivel' },
        { status: 400 }
      )
    }

    console.error('Error creating location:', error)
    return NextResponse.json(
      { error: 'Error al crear ubicación' },
      { status: 500 }
    )
  }
}
