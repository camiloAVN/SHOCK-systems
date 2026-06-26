import { z } from 'zod'

// Tipos de nodo en el árbol de ubicaciones, en orden jerárquico canónico.
export const locationTypes = [
  'SECTOR',
  'CUADRANTE',
  'RACK',
  'NIVEL',
  'POSICION',
] as const

export type LocationType = (typeof locationTypes)[number]

// Índice de orden jerárquico (menor = más cerca de la raíz).
export const locationTypeOrder: Record<LocationType, number> = {
  SECTOR: 0,
  CUADRANTE: 1,
  RACK: 2,
  NIVEL: 3,
  POSICION: 4,
}

// Etiquetas legibles.
export const locationTypeLabels: Record<LocationType, string> = {
  SECTOR: 'Sector',
  CUADRANTE: 'Cuadrante',
  RACK: 'Rack / Estante',
  NIVEL: 'Nivel',
  POSICION: 'Posición',
}

// Tipos que usan letras como código vs. números.
export const letterTypes: LocationType[] = ['SECTOR', 'RACK']
export const numberTypes: LocationType[] = ['CUADRANTE', 'NIVEL', 'POSICION']

// Separador usado para construir el fullPath legible.
export const LOCATION_PATH_SEPARATOR = ' · '

/**
 * Devuelve los tipos válidos para un hijo dado el tipo del padre.
 * Si parentType es null, sólo se permite SECTOR (nodo raíz).
 * Se permite saltar niveles, pero no retroceder ni repetir.
 */
export function allowedChildTypes(parentType: LocationType | null): LocationType[] {
  if (parentType === null) return ['SECTOR']
  const parentOrder = locationTypeOrder[parentType]
  return locationTypes.filter((t) => locationTypeOrder[t] > parentOrder)
}

/** Valida que el código corresponda al formato del tipo (letras o números). */
export function isValidCodeForType(type: LocationType, code: string): boolean {
  if (letterTypes.includes(type)) return /^[A-Za-z]+$/.test(code)
  return /^\d+$/.test(code)
}

/** Normaliza un código: mayúsculas para letras, sin cambios para números. */
export function normalizeCode(type: LocationType, code: string): string {
  const trimmed = code.trim()
  return letterTypes.includes(type) ? trimmed.toUpperCase() : trimmed
}

// Schema de creación de un nodo de ubicación.
export const locationSchema = z
  .object({
    type: z.enum(locationTypes),
    code: z
      .string()
      .trim()
      .min(1, 'El código es requerido')
      .max(10, 'El código no puede exceder 10 caracteres'),
    description: z.string().max(500, 'Máximo 500 caracteres').optional(),
    parentId: z.string().optional().nullable(),
  })
  .refine((data) => isValidCodeForType(data.type, data.code), {
    message: 'El código no coincide con el tipo (letras para Sector/Rack, números para los demás)',
    path: ['code'],
  })

export type LocationFormData = z.infer<typeof locationSchema>

// Schema de actualización (no se puede cambiar el tipo ni el padre, sólo code/description).
export const updateLocationSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'El código es requerido')
    .max(10, 'El código no puede exceder 10 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').optional().nullable(),
})

export type UpdateLocationFormData = z.infer<typeof updateLocationSchema>

// Schema para asignar/quitar la imagen 360 de un nodo.
// Las imágenes se sirven desde public/images/ubicaciones (mismo origen).
export const panoramaSchema = z.object({
  panoramaUrl: z
    .string()
    .regex(/^\/images\/ubicaciones\/[^/]+$/, 'Ruta de imagen inválida')
    .nullable(),
})

export type PanoramaFormData = z.infer<typeof panoramaSchema>

// Schema para colocar/borrar el marcador de un nodo sobre una panorámica.
export const markerSchema = z.object({
  markerYaw: z.number().nullable(),
  markerPitch: z.number().nullable(),
  markerOnLocationId: z.string().nullable(),
})

export type MarkerFormData = z.infer<typeof markerSchema>

// Tipo base de una ubicación.
export type Location = {
  id: string
  type: LocationType
  code: string
  description: string | null
  parentId: string | null
  fullPath: string
  panoramaUrl: string | null
  markerYaw: number | null
  markerPitch: number | null
  markerOnLocationId: string | null
  createdAt: Date
  updatedAt: Date
  _count?: {
    items: number
    children: number
  }
}

// Datos que el visor 360 necesita para mostrar un nodo objetivo.
export type PanoramaContextMarker = {
  id: string
  yaw: number
  pitch: number
  label: string
  highlight: boolean
}

export type PanoramaContext = {
  panoramaUrl: string | null
  panoramaLocationId: string | null
  target: { yaw: number; pitch: number; label: string } | null
  markers: PanoramaContextMarker[]
}

// Nodo del árbol (con hijos anidados).
export type LocationNode = Location & {
  children: LocationNode[]
}
