import { NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import path from 'path'
import { canViewModule } from '@/lib/auth/check-permission'

export const runtime = 'nodejs'

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp']
const PUBLIC_DIR = 'images/ubicaciones'

// GET /api/locations/panoramas - Lista las imágenes 360 disponibles en public/images/ubicaciones
export async function GET() {
  try {
    const permissionCheck = await canViewModule('ubicaciones')
    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      )
    }

    const dir = path.join(process.cwd(), 'public', PUBLIC_DIR)

    let files: string[] = []
    try {
      files = await readdir(dir)
    } catch {
      // La carpeta puede no existir aún
      return NextResponse.json([])
    }

    const panoramas = files
      .filter((name) => IMAGE_EXT.includes(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => ({ name, url: `/${PUBLIC_DIR}/${name}` }))

    return NextResponse.json(panoramas)
  } catch (error) {
    console.error('Error listing panoramas:', error)
    return NextResponse.json({ error: 'Error al listar imágenes 360' }, { status: 500 })
  }
}
