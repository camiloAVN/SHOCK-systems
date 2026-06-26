import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { canEditModule } from '@/lib/auth/check-permission'
import { markerSchema } from '@/lib/validations/location'
import { ZodError } from 'zod'

// PUT /api/locations/[id]/marker - Colocar/borrar el marcador del nodo sobre una panorámica
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
    const { markerYaw, markerPitch, markerOnLocationId } = markerSchema.parse(body)

    const current = await prisma.location.findUnique({ where: { id } })
    if (!current) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 })
    }

    const isSetting =
      markerYaw !== null && markerPitch !== null && markerOnLocationId !== null

    if (isSetting) {
      // El host del marcador debe existir y tener una panorámica
      const host = await prisma.location.findUnique({
        where: { id: markerOnLocationId! },
        select: { id: true, panoramaUrl: true },
      })
      if (!host || !host.panoramaUrl) {
        return NextResponse.json(
          { error: 'La ubicación destino no tiene imagen 360' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.location.update({
      where: { id },
      data: isSetting
        ? { markerYaw, markerPitch, markerOnLocationId }
        : { markerYaw: null, markerPitch: null, markerOnLocationId: null },
      include: { _count: { select: { items: true, children: true } } },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: error.issues },
        { status: 400 }
      )
    }
    console.error('Error updating location marker:', error)
    return NextResponse.json({ error: 'Error al actualizar marcador' }, { status: 500 })
  }
}
