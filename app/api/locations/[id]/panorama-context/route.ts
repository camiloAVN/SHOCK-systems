import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { checkAuth } from '@/lib/auth/check-permission'
import { PanoramaContext } from '@/lib/validations/location'

type Node = {
  id: string
  parentId: string | null
  fullPath: string
  panoramaUrl: string | null
  markerYaw: number | null
  markerPitch: number | null
  markerOnLocationId: string | null
}

// GET /api/locations/[id]/panorama-context
// Resuelve la panorámica + marcadores a mostrar para el nodo objetivo.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionCheck = await checkAuth()
    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      )
    }

    const { id } = await params

    const all = await prisma.location.findMany({
      select: {
        id: true,
        parentId: true,
        fullPath: true,
        panoramaUrl: true,
        markerYaw: true,
        markerPitch: true,
        markerOnLocationId: true,
      },
    })

    const map = new Map<string, Node>()
    all.forEach((n) => map.set(n.id, n))

    const target = map.get(id)
    const empty: PanoramaContext = {
      panoramaUrl: null,
      panoramaLocationId: null,
      target: null,
      markers: [],
    }

    if (!target) {
      return NextResponse.json(empty)
    }

    // Cadena [target, ...ancestros]
    const chain: Node[] = []
    let cursor: Node | undefined = target
    const seen = new Set<string>()
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id)
      chain.push(cursor)
      cursor = cursor.parentId ? map.get(cursor.parentId) : undefined
    }

    // Marcador M = primer nodo de la cadena con coordenadas definidas
    const marker = chain.find(
      (n) => n.markerYaw !== null && n.markerPitch !== null
    )

    // Determinar la panorámica a mostrar
    let panoramaLocationId: string | null = null
    if (marker?.markerOnLocationId && map.get(marker.markerOnLocationId)?.panoramaUrl) {
      panoramaLocationId = marker.markerOnLocationId
    } else {
      const withPano = chain.find((n) => n.panoramaUrl)
      panoramaLocationId = withPano?.id ?? null
    }

    if (!panoramaLocationId) {
      return NextResponse.json(empty)
    }

    const panoramaNode = map.get(panoramaLocationId)!
    const markers = all
      .filter(
        (n) =>
          n.markerOnLocationId === panoramaLocationId &&
          n.markerYaw !== null &&
          n.markerPitch !== null
      )
      .map((n) => ({
        id: n.id,
        yaw: n.markerYaw as number,
        pitch: n.markerPitch as number,
        label: n.fullPath,
        highlight: n.id === marker?.id,
      }))

    const result: PanoramaContext = {
      panoramaUrl: panoramaNode.panoramaUrl,
      panoramaLocationId,
      target:
        marker && marker.markerYaw !== null && marker.markerPitch !== null
          ? { yaw: marker.markerYaw, pitch: marker.markerPitch, label: marker.fullPath }
          : null,
      markers,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error resolving panorama context:', error)
    return NextResponse.json(
      { error: 'Error al resolver contexto 360' },
      { status: 500 }
    )
  }
}
