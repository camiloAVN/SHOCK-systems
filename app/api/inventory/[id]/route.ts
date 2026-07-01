import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { inventoryItemSchema } from '@/lib/validations/inventory'
import { canViewModule, canEditModule } from '@/lib/auth/check-permission'
import { ZodError } from 'zod'

// GET /api/inventory/[id] - Get single inventory item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionCheck = await canViewModule('items')
    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      )
    }

    const { id } = await params

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            brand: true,
            model: true,
            imageUrl: true,
            category: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
        container: {
          select: {
            id: true,
            assetTag: true,
            serialNumber: true,
          },
        },
        locationRef: {
          select: { id: true, type: true, code: true, fullPath: true },
        },
        contents: {
          select: {
            id: true,
            serialNumber: true,
            assetTag: true,
            status: true,
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
          },
        },
        rfidTag: {
          select: {
            id: true,
            epc: true,
            tid: true,
            status: true,
            lastSeenAt: true,
            firstSeenAt: true,
          },
        },
        movements: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            movements: true,
            contents: true,
          },
        },
      },
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Item de inventario no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error fetching inventory item:', error)
    return NextResponse.json(
      { error: 'Error al obtener item de inventario' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/[id] - Update inventory item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionCheck = await canEditModule('items')
    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      )
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = inventoryItemSchema.parse(body)

    // Get current item to track changes
    const currentItem = await prisma.inventoryItem.findUnique({
      where: { id },
    })

    if (!currentItem) {
      return NextResponse.json(
        { error: 'Item de inventario no encontrado' },
        { status: 404 }
      )
    }

    // Resolver ubicación estructurada (snapshot del fullPath)
    let locationId: string | null = null
    let locationPath: string | null = null
    if (validatedData.locationId) {
      const loc = await prisma.location.findUnique({
        where: { id: validatedData.locationId },
        select: { id: true, fullPath: true },
      })
      if (!loc) {
        return NextResponse.json(
          { error: 'Ubicación no encontrada' },
          { status: 404 }
        )
      }
      locationId = loc.id
      locationPath = loc.fullPath
    }

    // Clean data
    const data = {
      productId: validatedData.productId,
      serialNumber: validatedData.serialNumber || null,
      type: validatedData.type,
      status: validatedData.status,
      condition: validatedData.condition || null,
      location: locationPath,
      locationId,
      containerId: validatedData.containerId || null,
      // La cantidad solo aplica a contenedores; para otros tipos se guarda null.
      containerQuantity:
        validatedData.type === 'CONTAINER' ? validatedData.containerQuantity ?? null : null,
      purchaseDate: validatedData.purchaseDate ? new Date(validatedData.purchaseDate) : null,
      purchasePrice: validatedData.purchasePrice ?? null,
      warrantyExpiry: validatedData.warrantyExpiry ? new Date(validatedData.warrantyExpiry) : null,
      notes: validatedData.notes || null,
    }

    const item = await prisma.inventoryItem.update({
      where: { id },
      data,
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            brand: true,
            model: true,
            imageUrl: true,
            category: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
        locationRef: {
          select: { id: true, type: true, code: true, fullPath: true },
        },
        _count: {
          select: {
            movements: true,
            contents: true,
          },
        },
      },
    })

    // Create adjustment movement if status or location changed
    if (currentItem.status !== item.status || currentItem.location !== item.location) {
      await prisma.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          type: 'ADJUSTMENT',
          fromStatus: currentItem.status,
          toStatus: item.status,
          fromLocation: currentItem.location,
          toLocation: item.location,
          reason: 'Actualizacion manual',
          performedBy: permissionCheck.userId!,
        },
      })
    }

    return NextResponse.json(item)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos invalidos', issues: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Ya existe un item con ese numero de serie' },
        { status: 400 }
      )
    }

    console.error('Error updating inventory item:', error)
    return NextResponse.json(
      { error: 'Error al actualizar item de inventario' },
      { status: 500 }
    )
  }
}

// DELETE /api/inventory/[id] - Delete inventory item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionCheck = await canEditModule('items')
    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      )
    }

    const { id } = await params

    // Check if item exists and has contents
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: { contents: true },
        },
        rfidTag: true,
      },
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Item de inventario no encontrado' },
        { status: 404 }
      )
    }

    if (item._count.contents > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un contenedor con items dentro' },
        { status: 400 }
      )
    }

    // Unlink RFID tag if exists
    if (item.rfidTag) {
      await prisma.rfidTag.update({
        where: { id: item.rfidTag.id },
        data: {
          inventoryItemId: null,
          status: 'UNASSIGNED',
        },
      })
    }

    await prisma.inventoryItem.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting inventory item:', error)
    return NextResponse.json(
      { error: 'Error al eliminar item de inventario' },
      { status: 500 }
    )
  }
}
