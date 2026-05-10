'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Settings, FileText, Type, Palette, Building2, Save } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import toast from 'react-hot-toast'

type PDFFormat = 'clasico' | 'moderno' | 'minimalista'
type FontFamily = 'Helvetica' | 'Times-Roman' | 'Courier'

interface AppSettings {
  pdfFormat: PDFFormat
  fontFamily: FontFamily
  fontSize: number
  headerColor: string
  headerText: string
  nit: string
  companyEmail: string
  website: string
  address: string
  schedule: string
}

const DEFAULT: AppSettings = {
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

const formatOptions: { value: PDFFormat; label: string; description: string; preview: string }[] = [
  {
    value: 'clasico',
    label: 'Clásico',
    description: 'Encabezado en dos columnas, bordes definidos',
    preview: 'two-col',
  },
  {
    value: 'moderno',
    label: 'Moderno',
    description: 'Barra de color completa en el encabezado',
    preview: 'full-bar',
  },
  {
    value: 'minimalista',
    label: 'Minimalista',
    description: 'Centrado, sin fondos de color, líneas sutiles',
    preview: 'centered',
  },
]

const fontOptions: { value: FontFamily; label: string; style: string }[] = [
  { value: 'Helvetica', label: 'Helvetica', style: 'font-sans' },
  { value: 'Times-Roman', label: 'Times New Roman', style: 'font-serif' },
  { value: 'Courier', label: 'Courier', style: 'font-mono' },
]

const fontSizeOptions = [8, 9, 10, 11, 12]

function FormatPreview({ format, color }: { format: PDFFormat; color: string }) {
  if (format === 'clasico') {
    return (
      <div className="w-full h-20 bg-white rounded border border-gray-200 overflow-hidden p-2 text-[6px]">
        <div className="flex justify-between items-start mb-1 pb-1" style={{ borderBottom: `1.5px solid ${color}` }}>
          <div>
            <div className="font-bold" style={{ color }}>EMPRESA</div>
            <div className="text-gray-400">info@empresa.com</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-gray-700">QT-2024-0001</div>
            <div className="text-gray-400">Fecha: 01 Ene 2024</div>
          </div>
        </div>
        <div className="flex gap-0.5 mt-1">
          {['#','Descripción','Cant.','Precio','Total'].map(h => (
            <div key={h} className="flex-1 text-gray-500 truncate">{h}</div>
          ))}
        </div>
      </div>
    )
  }
  if (format === 'moderno') {
    return (
      <div className="w-full h-20 bg-white rounded border border-gray-200 overflow-hidden text-[6px]">
        <div className="flex justify-between items-center px-2 py-1.5" style={{ backgroundColor: color }}>
          <div className="text-white font-bold">EMPRESA</div>
          <div className="text-white/80">QT-2024-0001</div>
        </div>
        <div className="p-2">
          <div className="text-gray-400 mb-1">info@empresa.com · www.empresa.com</div>
          <div className="flex gap-0.5">
            {['#','Descripción','Cant.','Precio','Total'].map(h => (
              <div key={h} className="flex-1 text-gray-500 truncate">{h}</div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="w-full h-20 bg-white rounded border border-gray-200 overflow-hidden p-2 text-[6px]">
      <div className="text-center mb-1 pb-1 border-b border-gray-200">
        <div className="font-bold text-gray-700">EMPRESA</div>
        <div className="text-gray-400">info@empresa.com</div>
      </div>
      <div className="text-center font-bold mb-1" style={{ color }}>QT-2024-0001</div>
      <div className="flex gap-0.5">
        {['#','Descripción','Cant.','Precio','Total'].map(h => (
          <div key={h} className="flex-1 text-gray-500 truncate">{h}</div>
        ))}
      </div>
    </div>
  )
}

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setSettings({ ...DEFAULT, ...data }))
      .catch(() => toast.error('Error al cargar configuracion'))
      .finally(() => setIsLoading(false))
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error()
      toast.success('Configuracion guardada')
    } catch {
      toast.error('Error al guardar configuracion')
    } finally {
      setIsSaving(false)
    }
  }

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="w-8 h-8 text-orange-400" />
            Configuracion
          </h1>
          <p className="text-gray-400 mt-1">Personaliza el comportamiento del sistema</p>
        </div>
        <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          Guardar cambios
        </Button>
      </div>

      {/* ── PDF de Cotizaciones ──────────────────────────────────────────────── */}
      <Card>
        <Card.Content className="space-y-8">
          <h2 className="text-lg font-semibold flex items-center gap-2 pb-4 border-b border-gray-800">
            <FileText className="w-5 h-5 text-orange-400" />
            PDF de Cotizaciones
          </h2>

          {/* Formato */}
          <div>
            <p className="text-sm font-medium text-gray-200 mb-3">Formato del documento</p>
            <div className="grid grid-cols-3 gap-4">
              {formatOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('pdfFormat', opt.value)}
                  className={cn(
                    'rounded-xl border-2 p-3 text-left transition-all',
                    settings.pdfFormat === opt.value
                      ? 'border-orange-500 bg-orange-500/5'
                      : 'border-gray-700 hover:border-gray-600'
                  )}
                >
                  <FormatPreview format={opt.value} color={settings.headerColor} />
                  <p className="mt-2 font-medium text-sm text-gray-100">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Tipografía */}
          <div>
            <p className="text-sm font-medium text-gray-200 mb-3 flex items-center gap-2">
              <Type className="w-4 h-4 text-gray-400" />
              Tipografía
            </p>
            <div className="flex gap-3 flex-wrap">
              {fontOptions.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => set('fontFamily', f.value)}
                  className={cn(
                    'px-4 py-2.5 rounded-lg border text-sm transition-all',
                    f.style,
                    settings.fontFamily === f.value
                      ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                      : 'border-gray-700 text-gray-300 hover:border-gray-600'
                  )}
                >
                  {f.label}
                </button>
              ))}

              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm text-gray-400">Tamaño:</span>
                <div className="flex gap-1">
                  {fontSizeOptions.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => set('fontSize', size)}
                      className={cn(
                        'w-9 h-9 rounded-lg border text-sm font-medium transition-all',
                        settings.fontSize === size
                          ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                          : 'border-gray-700 text-gray-300 hover:border-gray-600'
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Encabezado */}
          <div>
            <p className="text-sm font-medium text-gray-200 mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-gray-400" />
              Encabezado
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Color del encabezado</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.headerColor}
                    onChange={(e) => set('headerColor', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-gray-700"
                  />
                  <Input
                    value={settings.headerColor}
                    onChange={(e) => set('headerColor', e.target.value)}
                    placeholder="#8b5cf6"
                    className="font-mono"
                  />
                </div>
              </div>
              <Input
                label="Texto del encabezado"
                placeholder="Ingeniería Robótica y Desarrollo de Software"
                value={settings.headerText}
                onChange={(e) => set('headerText', e.target.value)}
              />
            </div>
          </div>

          {/* Información de empresa */}
          <div>
            <p className="text-sm font-medium text-gray-200 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              Información de la empresa
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Los campos diligenciados aparecerán en el encabezado del PDF.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="NIT"
                placeholder="900.123.456-7"
                value={settings.nit}
                onChange={(e) => set('nit', e.target.value)}
              />
              <Input
                label="Correo electrónico"
                type="email"
                placeholder="info@empresa.com"
                value={settings.companyEmail}
                onChange={(e) => set('companyEmail', e.target.value)}
              />
              <Input
                label="Sitio web"
                placeholder="www.empresa.com"
                value={settings.website}
                onChange={(e) => set('website', e.target.value)}
              />
              <Input
                label="Dirección"
                placeholder="Calle 123 #45-67, Bogotá"
                value={settings.address}
                onChange={(e) => set('address', e.target.value)}
              />
              <div className="md:col-span-2">
                <Input
                  label="Horario de atención"
                  placeholder="Lun–Vie 8am–6pm"
                  value={settings.schedule}
                  onChange={(e) => set('schedule', e.target.value)}
                />
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Footer save */}
      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          Guardar cambios
        </Button>
      </div>
    </div>
  )
}
