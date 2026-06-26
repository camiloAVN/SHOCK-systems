'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import {
  Location,
  LocationType,
  locationTypeLabels,
  allowedChildTypes,
  isValidCodeForType,
  letterTypes,
} from '@/lib/validations/location'

interface LocationFormModalProps {
  isOpen: boolean
  onClose: () => void
  /** Nodo padre bajo el cual se crea (null = raíz/Sector). Sólo para modo crear. */
  parent?: Location | null
  /** Nodo a editar. Si se pasa, el modal entra en modo edición. */
  editing?: Location | null
  isSubmitting?: boolean
  onSubmit: (data: {
    type: LocationType
    code: string
    description?: string
  }) => Promise<unknown>
}

export function LocationFormModal({
  isOpen,
  onClose,
  parent = null,
  editing = null,
  isSubmitting = false,
  onSubmit,
}: LocationFormModalProps) {
  const isEdit = !!editing

  const typeOptions = useMemo<LocationType[]>(
    () => (isEdit ? [editing!.type] : allowedChildTypes(parent?.type ?? null)),
    [isEdit, editing, parent]
  )

  const [type, setType] = useState<LocationType>(typeOptions[0])
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)

  // Reinicializar al abrir / cambiar de contexto
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && editing) {
      setType(editing.type)
      setCode(editing.code)
      setDescription(editing.description ?? '')
    } else {
      setType(typeOptions[0])
      setCode('')
      setDescription('')
    }
    setCodeError(null)
  }, [isOpen, isEdit, editing, typeOptions])

  const expectsLetters = letterTypes.includes(type)

  const handleSubmit = async () => {
    const trimmed = code.trim()
    if (!trimmed) {
      setCodeError('El código es requerido')
      return
    }
    if (!isValidCodeForType(type, trimmed)) {
      setCodeError(
        expectsLetters
          ? 'Este tipo usa solo letras (ej. A, B)'
          : 'Este tipo usa solo números (ej. 1, 2)'
      )
      return
    }
    const result = await onSubmit({
      type,
      code: trimmed,
      description: description.trim() || undefined,
    })
    if (result) onClose()
  }

  const title = isEdit
    ? `Editar ${locationTypeLabels[editing!.type]}`
    : parent
      ? `Agregar dentro de "${parent.fullPath}"`
      : 'Nuevo Sector'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Tipo
          </label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as LocationType)
              setCodeError(null)
            }}
            disabled={isEdit || typeOptions.length === 1}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-900/50 border border-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {locationTypeLabels[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Código */}
        <Input
          label={`Código (${expectsLetters ? 'letras' : 'números'})`}
          placeholder={expectsLetters ? 'A' : '1'}
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setCodeError(null)
          }}
          error={codeError ?? undefined}
          autoFocus
        />

        {/* Descripción */}
        <Textarea
          label="Descripción (opcional)"
          placeholder="Detalle de la ubicación..."
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            isLoading={isSubmitting}
            onClick={handleSubmit}
          >
            {isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
