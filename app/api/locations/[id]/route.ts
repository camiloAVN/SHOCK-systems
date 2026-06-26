import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { canViewModule, canEditModule } from '@/lib/auth/check-permission'
import {
  updateLocationSchema,
  normalizeCode,
  LocationType,
  LOCATION_PATH_SEPARATOR,
} from '@/lib/validations/location'
import { ZodError } from 'zod'

// GET /api/locations/[id] - Obtener una ubicación
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionCheck = await canViewModule('ubicaciones')
    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      )
    }

    const { id } = await params

    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        _count: { select: { items: true, children: true } },
        parent: { select: { id: true, type: true, code: true, fullPath: true } },
      },
    })

    if (!location) {
      return NextResponse.json(
        { error: 'Ubicación no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(location)
  } catch (error) {
    console.error('Error fetching location:', error)
    return NextResponse.json(
      { error: 'Error al obtener ubicación' },
      { status: 500 }
    )
  }
}

// PUT /api/locations/[id] - Editar code/description (recalcula fullPath de descendientes)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionCheck = await canEditModule('ubicaciones')
    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      )
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateLocationSchema.parse(body)

    const current = await prisma.location.findUnique({
      where: { id },
      include: { parent: { select: { fullPath: true } } },
    })

    if (!current) {
      return NextResponse.json(
        { error: 'Ubicación no encontrada' },
        { status: 404 }
      )
    }

    const newCode = normalizeCode(current.type as LocationType, validatedData.code)
    const oldFullPath = current.fullPath
    const newFullPath = current.parent
      ? `${current.parent.fullPath}${LOCATION_PATH_SEPARATOR}${newCode}`
      : newCode

    const codeChanged = newCode !== current.code

    const updated = await prisma.$transaction(async (tx) => {
      const node = await tx.location.update({
        where: { id },
        data: {
          code: newCode,
          description: validatedData.description ?? null,
          fullPath: newFullPath,
        },
        include: { _count: { select: { items: true, children: true } } },
      })

      // Si cambió el fullPath, propagar a todos los descendientes
      if (codeChanged && oldFullPath !== newFullPath) {
        const prefix = `${oldFullPath}${LOCATION_PATH_SEPARATOR}`
        const descendants = await tx.location.findMany({
          where: { fullPath: { startsWith: prefix } },
          select: { id: true, fullPath: true },
        })

        for (const d of descendants) {
          await tx.location.update({
            where: { id: d.id },
            data: {
              fullPath: newFullPath + d.fullPath.slice(oldFullPath.length),
            },
          })
        }

        // Resincronizar el snapshot location de los items afectados
        await tx.inventoryItem.updateMany({
          where: { locationId: node.id },
          data: { location: newFullPath },
        })
        for (const d of descendants) {
          await tx.inventoryItem.updateMany({
            where: { locationId: d.id },
            data: { location: newFullPath + d.fullPath.slice(oldFullPath.length) },
          })
        }
      }

      return node
    })

    return NextResponse.json(updated)
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

    console.error('Error updating location:', error)
    return NextResponse.json(
      { error: 'Error al actualizar ubicación' },
      { status: 500 }
    )
  }
}

// DELETE /api/locations/[id] - Eliminar nodo (cascade a hijos; items quedan sin ubicación)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionCheck = await canEditModule('ubicaciones')
    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      )
    }

    const { id } = await params

    const location = await prisma.location.findUnique({ where: { id } })
    if (!location) {
      return NextResponse.json(
        { error: 'Ubicación no encontrada' },
        { status: 404 }
      )
    }

    // Limpiar el snapshot location de los items del subárbol antes de borrar
    const prefix = `${location.fullPath}${LOCATION_PATH_SEPARATOR}`
    const subtree = await prisma.location.findMany({
      where: {
        OR: [{ id }, { fullPath: { startsWith: prefix } }],
      },
      select: { id: true },
    })
    const ids = subtree.map((l) => l.id)

    await prisma.$transaction([
      prisma.inventoryItem.updateMany({
        where: { locationId: { in: ids } },
        data: { location: null },
      }),
      prisma.location.delete({ where: { id } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting location:', error)
    return NextResponse.json(
      { error: 'Error al eliminar ubicación' },
      { status: 500 }
    )
  }
}
