'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPinned } from 'lucide-react'
import toast from 'react-hot-toast'
import { AreaForm, type AreaFormValues } from '@/components/attendance/AreaForm'
import { Spinner } from '@/components/ui/Spinner'

type ProjectOption = { id: string; title: string; client?: { name: string } | null }

export default function NewAttendanceAreaPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectOption[] | null>(null)
  const [mapStyleUrl, setMapStyleUrl] = useState<string | null>(null)

  useEffect(() => {
    // Las opciones exigen permiso de edición: si no lo tiene, la API responde 403
    Promise.all([fetch('/api/attendance/options'), fetch('/api/attendance/areas')])
      .then(async ([opt, areas]) => {
        const [optBody, areasBody] = await Promise.all([opt.json(), areas.json()])
        if (!opt.ok) throw new Error(optBody.error || 'No tienes permiso para crear áreas')
        setProjects(optBody.projects)
        setMapStyleUrl(areasBody.mapStyleUrl)
      })
      .catch((e) => {
        toast.error(e.message)
        router.replace('/dashboard/asistencia/areas')
      })
  }, [router])

  const create = async (values: AreaFormValues) => {
    try {
      const response = await fetch('/api/attendance/areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Error al crear el área')
      toast.success('Área creada. Ahora asígnala a una persona o equipo.')
      router.push(`/dashboard/asistencia/areas/${body.id}`)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/asistencia/areas" className="mb-2 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
          <ArrowLeft className="h-4 w-4" /> Áreas
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <MapPinned className="h-7 w-7 text-orange-400" />
          Nueva área
        </h1>
      </div>
      {projects && mapStyleUrl ? (
        <AreaForm projects={projects} mapStyleUrl={mapStyleUrl} submitLabel="Crear área" onSubmit={create} />
      ) : (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      )}
    </div>
  )
}
