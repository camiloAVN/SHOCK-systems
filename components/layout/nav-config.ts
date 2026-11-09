import {
  LayoutDashboard,
  FolderKanban,
  Users,
  FileText,
  ListTodo,
  Package,
  Boxes,
  Package2,
  FolderTree,
  MapPin,
  Radio,
  ArrowRightLeft,
  UsersRound,
  Briefcase,
  Settings,
  UserCog,
  Mail,
  Contact,
  LucideIcon,
} from 'lucide-react'
import { SystemModule } from '@/lib/validations/user'

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  /** Visible if the user can view ANY of these modules */
  modules?: SystemModule[]
  /** Only for ADMIN / SUPERADMIN */
  adminOnly?: boolean
  /** Extra path prefixes that should mark this entry as active */
  matches?: string[]
  /** Used when the user can't view modules[0] but can view another listed module */
  fallbackHref?: string
  hint?: string
}

export function resolveHref(item: NavItem, canView: (m: SystemModule) => boolean) {
  if (item.fallbackHref && item.modules?.length && !canView(item.modules[0])) return item.fallbackHref
  return item.href
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    title: 'General',
    items: [
      { name: 'Inicio', href: '/dashboard', icon: LayoutDashboard, modules: ['dashboard'] },
      { name: 'Tareas', href: '/dashboard/tareas', icon: ListTodo, modules: ['tareas'] },
      { name: 'Equipo', href: '/dashboard/equipo', icon: Contact, hint: 'Equipos de trabajo y labores' },
    ],
  },
  {
    title: 'Comercial',
    items: [
      { name: 'Clientes', href: '/dashboard/clientes', icon: Users, modules: ['clientes'] },
      { name: 'Proyectos', href: '/dashboard/proyectos', icon: FolderKanban, modules: ['proyectos'] },
      { name: 'Cotizaciones', href: '/dashboard/cotizaciones', icon: FileText, modules: ['cotizaciones'] },
    ],
  },
  {
    title: 'Inventario',
    items: [
      { name: 'Resumen', href: '/dashboard/inventario', icon: Package, modules: ['inventario'] },
      {
        name: 'Equipos',
        href: '/dashboard/inventario/productos',
        icon: Boxes,
        modules: ['productos', 'items'],
        matches: ['/dashboard/inventario/items'],
        fallbackHref: '/dashboard/inventario/items',
        hint: 'Productos y sus unidades',
      },
      { name: 'Paquetes', href: '/dashboard/inventario/grupos', icon: Package2, modules: ['grupos'], hint: 'Grupos de equipos' },
      { name: 'Categorías', href: '/dashboard/categorias', icon: FolderTree, modules: ['categorias'] },
      { name: 'Ubicaciones', href: '/dashboard/inventario/ubicaciones', icon: MapPin, modules: ['ubicaciones'] },
      { name: 'RFID', href: '/dashboard/inventario/rfid', icon: Radio, modules: ['rfid'] },
      { name: 'Movimientos', href: '/dashboard/inventario/movimientos', icon: ArrowRightLeft, modules: ['movimientos'] },
    ],
  },
  {
    title: 'Terceros',
    items: [
      { name: 'Contratistas', href: '/dashboard/terceros/contratistas', icon: UsersRound, modules: ['contratistas'] },
      { name: 'Conceptos', href: '/dashboard/terceros/conceptos', icon: Briefcase, modules: ['conceptos'] },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { name: 'Configuración', href: '/dashboard/configuracion', icon: Settings, modules: ['configuracion'] },
      { name: 'Usuarios', href: '/dashboard/usuarios', icon: UserCog, adminOnly: true },
      { name: 'Comunicados', href: '/dashboard/comunicados', icon: Mail, adminOnly: true },
    ],
  },
]

export function isNavActive(pathname: string | null, item: NavItem) {
  if (!pathname) return false
  if (item.href === '/dashboard') return pathname === '/dashboard'
  if (item.href === '/dashboard/inventario') return pathname === '/dashboard/inventario'
  const prefixes = [item.href, ...(item.matches ?? [])]
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

/** Human labels for URL segments (breadcrumbs) */
export const segmentLabels: Record<string, string> = {
  dashboard: 'Inicio',
  proyectos: 'Proyectos',
  clientes: 'Clientes',
  cotizaciones: 'Cotizaciones',
  tareas: 'Tareas',
  inventario: 'Inventario',
  productos: 'Equipos',
  items: 'Unidades',
  grupos: 'Paquetes',
  categorias: 'Categorías',
  ubicaciones: 'Ubicaciones',
  rfid: 'RFID',
  desconocidos: 'Desconocidos',
  movimientos: 'Movimientos',
  terceros: 'Terceros',
  contratistas: 'Contratistas',
  conceptos: 'Conceptos',
  proveedores: 'Proveedores',
  configuracion: 'Configuración',
  usuarios: 'Usuarios',
  comunicados: 'Comunicados',
  perfil: 'Mi perfil',
  equipo: 'Equipo',
  historial: 'Historial',
  nuevo: 'Nuevo',
  editar: 'Editar',
}
