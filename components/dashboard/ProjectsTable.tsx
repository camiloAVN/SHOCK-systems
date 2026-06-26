'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  Project,
  statusLabels,
  statusColors,
  priorityLabels,
  priorityColors,
  taskStatusLabels,
  taskStatusColors,
  TaskStatus,
  Priority,
} from '@/lib/validations/project'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Timer,
  User,
  Clock,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ProjectsTableProps {
  projects: Project[]
  onDelete?: (id: string) => void
  showActions?: boolean
}

function TaskProgressCell({ project }: { project: Project }) {
  const [isOpen, setIsOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const tasks = project.tasks || []

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 8,
      left: rect.left,
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return

    updatePosition()

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    function handleScroll() {
      updatePosition()
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen, updatePosition])

  const total = tasks.length
  const completed = tasks.filter((t) => t.status === 'DONE').length
  const allDone = total > 0 && completed === total

  if (total === 0) {
    return <span className="text-gray-500 text-sm">Sin tareas</span>
  }

  const percentage = Math.round((completed / total) * 100)

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 group"
      >
        {allDone ? (
          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
        ) : (
          <div className="w-4 h-4 flex-shrink-0 relative">
            <svg className="w-4 h-4 -rotate-90" viewBox="0 0 16 16">
              <circle
                cx="8"
                cy="8"
                r="6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-700"
              />
              <circle
                cx="8"
                cy="8"
                r="6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${(percentage / 100) * 37.7} 37.7`}
                className="text-orange-400"
              />
            </svg>
          </div>
        )}
        <span
          className={`text-sm font-medium ${
            allDone ? 'text-green-400' : 'text-gray-300'
          }`}
        >
          {completed}/{total}
        </span>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors" />
        )}
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="p-3 border-b border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400">
                Progreso de tareas
              </span>
              <span className="text-xs text-gray-500">{percentage}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  allDone ? 'bg-green-400' : 'bg-orange-400'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="px-3 py-2.5 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/50"
              >
                <div className="flex items-start gap-2">
                  {task.status === 'DONE' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                  ) : task.status === 'IN_PROGRESS' ? (
                    <Timer className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${
                        task.status === 'DONE'
                          ? 'line-through text-gray-500'
                          : 'text-gray-200'
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <Badge
                        className={`text-[10px] px-1.5 py-0 ${
                          taskStatusColors[task.status as TaskStatus]
                        }`}
                      >
                        {taskStatusLabels[task.status as TaskStatus]}
                      </Badge>
                      <Badge
                        className={`text-[10px] px-1.5 py-0 ${
                          priorityColors[task.priority as Priority]
                        }`}
                      >
                        {priorityLabels[task.priority as Priority]}
                      </Badge>
                      {task.assignedUser && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                          <User className="w-2.5 h-2.5" />
                          {task.assignedUser.name || task.assignedUser.email}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                          <Clock className="w-2.5 h-2.5" />
                          {format(new Date(task.dueDate), 'dd MMM', { locale: es })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export function ProjectsTable({ projects, onDelete, showActions = true }: ProjectsTableProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No hay proyectos registrados</p>
        <p className="text-sm text-gray-500 mt-2">
          Crea tu primer proyecto para comenzar
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table className="table-cards">
        <thead>
          <tr>
            <th>Proyecto</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Prioridad</th>
            <th>Tareas</th>
            <th>Asignado a</th>
            <th>Fecha Inicio</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td className="font-medium">{project.title}</td>
              <td>
                {project.client?.name}
                {project.client?.company && (
                  <span className="text-sm text-gray-500 block">
                    {project.client.company}
                  </span>
                )}
              </td>
              <td>
                <Badge className={statusColors[project.status]}>
                  {statusLabels[project.status]}
                </Badge>
              </td>
              <td>
                <Badge className={priorityColors[project.priority]}>
                  {priorityLabels[project.priority]}
                </Badge>
              </td>
              <td>
                <TaskProgressCell project={project} />
              </td>
              <td>{project.assignedUser?.name || project.assignedUser?.email}</td>
              <td>
                {project.startDate
                  ? format(new Date(project.startDate), 'dd MMM yyyy', {
                      locale: es,
                    })
                  : '-'}
              </td>
              <td>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/proyectos/${project.id}`}>
                    <Button variant="ghost" size="sm" title="Ver detalles">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                  {showActions && (
                    <>
                      <Link href={`/dashboard/proyectos/${project.id}/editar`}>
                        <Button variant="ghost" size="sm" title="Editar">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </Link>
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => {
                            if (
                              confirm(
                                '¿Estas seguro de que deseas eliminar este proyecto?'
                              )
                            ) {
                              onDelete(project.id)
                            }
                          }}
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}
