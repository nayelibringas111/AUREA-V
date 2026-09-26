import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
  FileText,
  Grid3x3,
  History,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  MoveRight,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sigma,
  Store,
  Target,
  Users,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { cn, ROLE_LABELS } from '@/lib/utils'

interface Item {
  to: string
  label: string
  icon: ReactNode
  module: string
}
interface Group {
  label: string
  items: Item[]
}

const ic = 'size-4'
const NAV: (Item | Group)[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className={ic} />, module: 'dashboard' },
  { to: '/carnet', label: 'Mi carnet', icon: <IdCard className={ic} />, module: 'carnet' },
  {
    label: 'Empresa',
    items: [
      { to: '/empresa', label: 'Datos de la empresa', icon: <Building2 className={ic} />, module: 'empresa' },
      { to: '/sucursales', label: 'Sucursales', icon: <Store className={ic} />, module: 'sucursales' },
      { to: '/productos', label: 'Productos', icon: <Package className={ic} />, module: 'productos' },
    ],
  },
  { to: '/ventas', label: 'Ventas', icon: <ShoppingCart className={ic} />, module: 'ventas' },
  { to: '/inventario', label: 'Inventario', icon: <Boxes className={ic} />, module: 'inventario' },
  { to: '/metas', label: 'Metas', icon: <Target className={ic} />, module: 'metas' },
  {
    label: 'Análisis matemático',
    items: [
      { to: '/vectores', label: 'Vectores', icon: <MoveRight className={ic} />, module: 'vectores' },
      { to: '/matrices', label: 'Matrices', icon: <Grid3x3 className={ic} />, module: 'matrices' },
      { to: '/operaciones', label: 'Operaciones', icon: <Sigma className={ic} />, module: 'operaciones' },
      { to: '/combinaciones', label: 'Combinaciones lineales', icon: <Activity className={ic} />, module: 'combinaciones' },
    ],
  },
  { to: '/historial', label: 'Historial', icon: <History className={ic} />, module: 'historial' },
  { to: '/reportes', label: 'Reportes', icon: <BarChart3 className={ic} />, module: 'reportes' },
  { to: '/usuarios', label: 'Usuarios', icon: <Users className={ic} />, module: 'usuarios' },
  { to: '/auditoria', label: 'Auditoría', icon: <ShieldCheck className={ic} />, module: 'auditoria' },
  { to: '/configuracion', label: 'Configuración', icon: <Settings className={ic} />, module: 'configuracion' },
]

function NavItem({ item, onNavigate }: { item: Item; onNavigate: () => void }) {
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive ? 'bg-primary text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
        )
      }
    >
      {item.icon}
      {item.label}
    </NavLink>
  )
}

function NavGroup({ group, onNavigate }: { group: Group; onNavigate: () => void }) {
  const { pathname } = useLocation()
  const active = group.items.some((i) => pathname.startsWith(i.to))
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center justify-between px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider',
          active ? 'text-accent' : 'text-slate-500',
        )}
      >
        {group.label}
        <ChevronDown className={cn('size-3 transition-transform', !open && '-rotate-90')} />
      </button>
      {open && (
        <div className="space-y-0.5">
          {group.items.map((i) => (
            <NavItem key={i.to} item={i} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

export function Logo({ light = true }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="size-8" />
      <div className="leading-tight">
        <div className={cn('text-base font-bold tracking-[0.15em]', light ? 'text-white' : 'text-ink')}>
          AUREA <span className="text-accent">V</span>
        </div>
        <div className={cn('text-[10px] font-medium tracking-[0.12em]', light ? 'text-slate-400' : 'text-muted')}>ANALÍTICA EMPRESARIAL</div>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const { user, can, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const close = () => setMobileOpen(false)

  const visible = NAV.map((n) =>
    'items' in n ? { ...n, items: n.items.filter((i) => can(i.module)) } : n,
  ).filter((n) => ('items' in n ? n.items.length > 0 : can(n.module)))

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-sidebar">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo />
        <button className="text-slate-400 lg:hidden" onClick={close} aria-label="Cerrar menú">
          <X className="size-5" />
        </button>
      </div>
      <nav className="scroll-thin flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {visible.map((n) => ('items' in n ? <NavGroup key={n.label} group={n} onNavigate={close} /> : <NavItem key={n.to} item={n} onNavigate={close} />))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="text-sm font-medium text-white">{user?.full_name}</div>
        <div className="text-xs text-slate-400">{user?.email}</div>
        <div className="mt-3 flex items-center justify-between">
          <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-medium text-accent">{ROLE_LABELS[user?.role.name ?? '']}</span>
          <button onClick={logout} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
            <LogOut className="size-3.5" /> Salir
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex h-full">
      <div className="hidden lg:block">{sidebar}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={close} />
          <div className="relative h-full">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-line bg-white px-4 lg:hidden">
          <button onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
            <Menu className="size-5" />
          </button>
          <Logo light={false} />
        </header>
        <main className="scroll-thin flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
          <footer className="px-8 pb-6 text-center text-xs text-muted">
            <FileText className="mr-1 inline size-3" /> Aurea V · versión 1.1 · TecnoAndes Distribuciones S.A.C.
          </footer>
        </main>
      </div>
    </div>
  )
}
