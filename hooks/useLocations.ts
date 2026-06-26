'use client'

import { useCallback } from 'react'
import { useLocationStore } from '@/store/locationStore'
import {
  Location,
  LocationNode,
  LocationFormData,
  UpdateLocationFormData,
} from '@/lib/validations/location'
import toast from 'react-hot-toast'

// Aplana el árbol en una lista ordenada por fullPath (para selectores).
function flattenTree(nodes: LocationNode[]): Location[] {
  const result: Location[] = []
  const walk = (list: LocationNode[]) => {
    for (const node of list) {
      const { children, ...rest } = node
      result.push(rest)
      if (children?.length) walk(children)
    }
  }
  walk(nodes)
  return result.sort((a, b) => a.fullPath.localeCompare(b.fullPath))
}

export function useLocations() {
  const {
    tree,
    flatList,
    isLoading,
    error,
    setTree,
    setFlatList,
    setLoading,
    setError,
  } = useLocationStore()

  const fetchTree = useCallback(async (options?: { silent?: boolean }) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/locations')

      // Manejar errores de permiso silenciosamente
      if (response.status === 401 || response.status === 403) {
        setTree([])
        setFlatList([])
        return
      }

      if (!response.ok) {
        throw new Error('Error al obtener ubicaciones')
      }

      const data: LocationNode[] = await response.json()
      setTree(data)
      setFlatList(flattenTree(data))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      if (!options?.silent) {
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }, [setTree, setFlatList, setLoading, setError])

  const createLocation = useCallback(async (data: LocationFormData) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al crear ubicación')
      }

      const newLocation = await response.json()
      await fetchTree({ silent: true })
      toast.success('Ubicación creada exitosamente')
      return newLocation
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      toast.error(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [fetchTree, setLoading, setError])

  const editLocation = useCallback(async (id: string, data: UpdateLocationFormData) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/locations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al actualizar ubicación')
      }

      const updated = await response.json()
      await fetchTree({ silent: true })
      toast.success('Ubicación actualizada exitosamente')
      return updated
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      toast.error(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [fetchTree, setLoading, setError])

  const deleteLocation = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/locations/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al eliminar ubicación')
      }

      await fetchTree({ silent: true })
      toast.success('Ubicación eliminada exitosamente')
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [fetchTree, setLoading, setError])

  return {
    tree,
    flatList,
    isLoading,
    error,
    fetchTree,
    createLocation,
    editLocation,
    deleteLocation,
  }
}
