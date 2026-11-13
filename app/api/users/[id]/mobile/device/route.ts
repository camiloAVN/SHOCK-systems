import { NextRequest, NextResponse } from 'next/server'
import { createAuditLog, getRequestClientInfo } from '@/lib/audit/log'
import { unbindActiveDevice } from '@/lib/mobile/activation'
import { requireAdminOver } from '@/lib/mobile/admin-access'

export const dynamic = 'force-dynamic'

// DELETE /api/users/[id]/mobile/device — desvincula el teléfono activo del empleado.
// Cierra además las sesiones de la app abiertas en ese teléfono.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const access = await requireAdminOver(id, { write: true })
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const device = await unbindActiveDevice(id, access.actorId, 'admin_unbind')
    if (!device) return NextResponse.json({ error: 'El empleado no tiene un teléfono vinculado' }, { status: 404 })

    const { ipAddress, userAgent } = getRequestClientInfo(request)
    await createAuditLog({
      module: 'usuarios',
      action: 'MOBILE_DEVICE_UNBOUND',
      entityType: 'user',
      entityId: id,
      description: `Teléfono desvinculado de la app para ${access.target.email} (${device.deviceModel ?? 'modelo desconocido'})`,
      metadata: {
        userId: id,
        userEmail: access.target.email,
        deviceId: device.id,
        platform: device.platform,
        deviceModel: device.deviceModel,
        boundAt: device.boundAt.toISOString(),
      },
      performedBy: access.actorId,
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ unbound: true })
  } catch (error) {
    console.error('Error unbinding mobile device:', error)
    return NextResponse.json({ error: 'Error al desvincular el teléfono' }, { status: 500 })
  }
}
