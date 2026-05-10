import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { auth } from '@/auth'

const SETTINGS_PATH = join(process.cwd(), 'data', 'settings.json')

const DEFAULT_SETTINGS = {
  pdfFormat: 'clasico',
  fontFamily: 'Helvetica',
  fontSize: 10,
  headerColor: '#8b5cf6',
  headerText: '',
  nit: '',
  companyEmail: '',
  website: '',
  address: '',
  schedule: '',
}

function readSettings() {
  try {
    if (!existsSync(SETTINGS_PATH)) return DEFAULT_SETTINGS
    return JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'))
  } catch {
    return DEFAULT_SETTINGS
  }
}

function writeSettings(data: Record<string, unknown>) {
  const dir = join(process.cwd(), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  return NextResponse.json(readSettings())
}

export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const current = readSettings()
    const updated = {
      pdfFormat: body.pdfFormat ?? current.pdfFormat,
      fontFamily: body.fontFamily ?? current.fontFamily,
      fontSize: typeof body.fontSize === 'number' ? body.fontSize : current.fontSize,
      headerColor: body.headerColor ?? current.headerColor,
      headerText: body.headerText ?? current.headerText,
      nit: body.nit ?? current.nit,
      companyEmail: body.companyEmail ?? current.companyEmail,
      website: body.website ?? current.website,
      address: body.address ?? current.address,
      schedule: body.schedule ?? current.schedule,
    }
    writeSettings(updated)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json({ error: 'Error al guardar configuracion' }, { status: 500 })
  }
}
