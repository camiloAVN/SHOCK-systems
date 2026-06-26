import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { canEditModule } from '@/lib/auth/check-permission'
import { panoramaSchema } from '@/lib/validations/location'
import { ZodError } from 'zod'

// PUT /api/locations/[id]/panorama - Asignar/reemplazar/quitar la imagen 360 del nodo
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
    const { panoramaUrl } = panoramaSchema.parse(body)

    const current = await prisma.location.findUnique({ where: { id } })
    if (!current) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 })
    }

    // Las imágenes viven en public/images/ubicaciones (fijas/compartidas): no se borran al cambiar.
    let updated = await prisma.location.update({
      where: { id },
      data: { panoramaUrl },
      include: { _count: { select: { items: true, children: true } } },
    })

    // Si se quitó la panorámica, limpiar los marcadores que dependían de ella
    if (!panoramaUrl) {
      await prisma.location.updateMany({
        where: { markerOnLocationId: id },
        data: { markerYaw: null, markerPitch: null, markerOnLocationId: null },
      })
      updated = await prisma.location.findUniqueOrThrow({
        where: { id },
        include: { _count: { select: { items: true, children: true } } },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: error.issues },
        { status: 400 }
      )
    }
    console.error('Error updating location panorama:', error)
    return NextResponse.json({ error: 'Error al actualizar imagen 360' }, { status: 500 })
  }
}
