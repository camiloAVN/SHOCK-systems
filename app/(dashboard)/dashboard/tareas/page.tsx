'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTasks } from '@/hooks/useTasks'
import { usePermissions } from '@/hooks/usePermissions'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  Search,
  Filter,
  ListTodo,
  User,
  Clock,
  FolderKanban,
  CheckCircle2,
  Circle,
  Timer,
  AlertTriangle,
} from 'lucide-react'
import { format, isPast, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  taskStatusLabels,
  taskStatusColors,
  priorityLabels,
  priorityColors,
  TaskStatus,
  Priority,
} from '@/lib/validations/project'

const statusIcons: Record<TaskStatus, React.ReactNode> = {
  TODO: <Circle className="w-4 h-4" />,
  IN_PROGRESS: <Timer className="w-4 h-4" />,
  DONE: <CheckCircle2 className="w-4 h-4" />,
}

export default function TareasPage() {
  const {
    tasks,
    isLoading,
    searchQuery,
    filters,
    setSearchQuery,
    setFilters,
    fetchTasks,
    changeTaskStatus,
  } = useTasks()
  const { canEdit } = usePermissions()
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [showFilters, setShowFilters] = useState(false)

  const hasEditPermission = canEdit('tareas')

  useEffect(() => {
    fetchTasks({ search: searchQuery, ...filters })
  }, [fetchTasks, searchQuery, filters])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(localSearch)
  }

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'myTasks') {
      setFilters({
        ...filters,
        myTasks: value === 'true' ? true : undefined,
      })
    } else {
      setFilters({
        ...filters,
        [key]: value || undefined,
      })
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    await changeTaskStatus(taskId, newStatus)
  }

  const statusOptions = [
    { value: '', label: 'Todos los estados' },
    ...Object.entries(taskStatusLabels).map(([value, label]) => ({
      value,
      label,
    })),
  ]

  const priorityOptions = [
    { value: '', label: 'Todas las prioridades' },
    ...Object.entries(priorityLabels).map(([value, label]) => ({
      value,
      label,
    })),
  ]

  const assignmentOptions = [
    { value: '', label: 'Todas las tareas' },
    { value: 'true', label: 'Mis tareas' },
  ]

  const getDueDateColor = (dueDate: Date | string | null) => {
    if (!dueDate) return ''
    const date = new Date(dueDate)
    if (isPast(date) && !isToday(date)) return 'text-red-400'
    if (isToday(date)) return 'text-amber-400'
    return 'text-gray-400'
  }

  const getDueDateLabel = (dueDate: Date | string | null) => {
    if (!dueDate) return null
    const date = new Date(dueDate)
    if (isPast(date) && !isToday(date)) return 'Vencida'
    if (isToday(date)) return 'Hoy'
    return null
  }

  // Stats
  const totalTasks = tasks.length
  const todoTasks = tasks.filter((t) => t.status === 'TODO').length
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <ListTodo className="w-8 h-8 text-orange-400" />
            Tareas
          </h1>
          <p className="text-gray-400 mt-1">
            Gestiona y da seguimiento a tus tareas asignadas
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Total</p>
          <p className="text-2xl font-bold mt-1">{totalTasks}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Por Hacer</p>
          <p className="text-2xl font-bold mt-1 text-gray-300">{todoTasks}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">En Progreso</p>
          <p className="text-2xl font-bold mt-1 text-orange-400">{inProgressTasks}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Completadas</p>
          <p className="text-2xl font-bold mt-1 text-green-400">{doneTasks}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <Card.Header>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Buscar tareas por título, descripción o proyecto..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
              <Button type="submit" variant="outline">
                Buscar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-800">
                <Select
                  label="Estado"
                  options={statusOptions}
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                />
                <Select
                  label="Prioridad"
                  options={priorityOptions}
                  value={filters.priority || ''}
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                />
                <Select
                  label="Asignación"
                  options={assignmentOptions}
                  value={filters.myTasks ? 'true' : ''}
                  onChange={(e) => handleFilterChange('myTasks', e.target.value)}
                />
              </div>
            )}
          </form>
        </Card.Header>
        <Card.Content>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 mt-4">Cargando tareas...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <ListTodo className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No se encontraron tareas</p>
              <p className="text-gray-500 text-sm mt-1">
                Las tareas se crean desde los proyectos
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const dueDateColor = getDueDateColor(task.dueDate)
                const dueDateLabel = getDueDateLabel(task.dueDate)

                return (
                  <div
                    key={task.id}
                    className={`p-4 rounded-lg border transition-all duration-200 ${
                      task.status === 'DONE'
                        ? 'bg-gray-800/30 border-gray-700/30 opacity-70'
                        : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Status Toggle */}
                      {hasEditPermission && (
                        <div className="pt-0.5">
                          <button
                            onClick={() => {
                              const nextStatus: Record<TaskStatus, TaskStatus> = {
                                TODO: 'IN_PROGRESS',
                                IN_PROGRESS: 'DONE',
                                DONE: 'TODO',
                              }
                              handleStatusChange(task.id, nextStatus[task.status as TaskStatus])
                            }}
                            className={`transition-colors ${
                              task.status === 'DONE'
                                ? 'text-green-400 hover:text-gray-400'
                                : task.status === 'IN_PROGRESS'
                                ? 'text-orange-400 hover:text-green-400'
                                : 'text-gray-500 hover:text-orange-400'
                            }`}
                            title={`Cambiar estado: ${taskStatusLabels[task.status as TaskStatus]}`}
                          >
                            {statusIcons[task.status as TaskStatus]}
                          </button>
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3
                              className={`font-medium ${
                                task.status === 'DONE'
                                  ? 'line-through text-gray-500'
                                  : 'text-gray-100'
                              }`}
                            >
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* Status Select (edit permission) */}
                          {hasEditPermission && (
                            <select
                              value={task.status}
                              onChange={(e) =>
                                handleStatusChange(task.id, e.target.value as TaskStatus)
                              }
                              className="text-xs bg-gray-900 border border-gray-700 rounded-md px-2 py-1 text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            >
                              {Object.entries(taskStatusLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <Badge className={taskStatusColors[task.status as TaskStatus]}>
                            {taskStatusLabels[task.status as TaskStatus]}
                          </Badge>
                          <Badge className={priorityColors[task.priority as Priority]}>
                            {priorityLabels[task.priority as Priority]}
                          </Badge>

                          {task.project && (
                            <Link
                              href={`/dashboard/proyectos/${task.project.id}`}
                              className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                            >
                              <FolderKanban className="w-3.5 h-3.5" />
                              {task.project.title}
                            </Link>
                          )}

                          {task.assignedUser && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <User className="w-3.5 h-3.5" />
                              {task.assignedUser.name || task.assignedUser.email}
                            </span>
                          )}

                          {!task.assignedTo && (
                            <span className="flex items-center gap-1 text-xs text-amber-400">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Sin asignar
                            </span>
                          )}

                          {task.dueDate && (
                            <span className={`flex items-center gap-1 text-xs ${dueDateColor}`}>
                              <Clock className="w-3.5 h-3.5" />
                              {format(new Date(task.dueDate), 'dd MMM yyyy', { locale: es })}
                              {dueDateLabel && (
                                <span className="font-medium">({dueDateLabel})</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  )
}
