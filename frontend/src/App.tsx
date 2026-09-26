import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import { Spinner } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import LoginPage from '@/pages/Login'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Empresa = lazy(() => import('@/pages/Empresa'))
const Sucursales = lazy(() => import('@/pages/Sucursales'))
const Productos = lazy(() => import('@/pages/Productos'))
const Ventas = lazy(() => import('@/pages/Ventas'))
const Inventario = lazy(() => import('@/pages/Inventario'))
const Metas = lazy(() => import('@/pages/Metas'))
const Vectores = lazy(() => import('@/pages/Vectores'))
const Matrices = lazy(() => import('@/pages/Matrices'))
const Operaciones = lazy(() => import('@/pages/Operaciones'))
const Combinaciones = lazy(() => import('@/pages/Combinaciones'))
const Historial = lazy(() => import('@/pages/Historial'))
const Reportes = lazy(() => import('@/pages/Reportes'))
const Usuarios = lazy(() => import('@/pages/Usuarios'))
const Auditoria = lazy(() => import('@/pages/Auditoria'))
const Configuracion = lazy(() => import('@/pages/Configuracion'))
const CarnetPage = lazy(() => import('@/pages/CarnetPage'))

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner label="Verificando sesión…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

function Guard({ module, children }: { module: string; children: ReactNode }) {
  const { can } = useAuth()
  if (!can(module)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Su rol no tiene acceso al módulo <b>{module}</b>.
      </div>
    )
  }
  return <Suspense fallback={<Spinner />}>{children}</Suspense>
}

const routes: [string, string, ReactNode][] = [
  ['dashboard', 'dashboard', <Dashboard />],
  ['carnet', 'carnet', <CarnetPage />],
  ['empresa', 'empresa', <Empresa />],
  ['sucursales', 'sucursales', <Sucursales />],
  ['productos', 'productos', <Productos />],
  ['ventas', 'ventas', <Ventas />],
  ['inventario', 'inventario', <Inventario />],
  ['metas', 'metas', <Metas />],
  ['vectores', 'vectores', <Vectores />],
  ['matrices', 'matrices', <Matrices />],
  ['operaciones', 'operaciones', <Operaciones />],
  ['combinaciones', 'combinaciones', <Combinaciones />],
  ['historial', 'historial', <Historial />],
  ['reportes', 'reportes', <Reportes />],
  ['usuarios', 'usuarios', <Usuarios />],
  ['auditoria', 'auditoria', <Auditoria />],
  ['configuracion', 'configuracion', <Configuracion />],
]

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        {routes.map(([path, module, el]) => (
          <Route key={path} path={path} element={<Guard module={module}>{el}</Guard>} />
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
