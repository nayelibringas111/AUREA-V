import { zodResolver } from '@hookform/resolvers/zod'
import { BarChart3, Grid3x3, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '@/components/layout/AppLayout'
import { Button, ErrorBox, Field, Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { loginSchema, type LoginForm } from '@/schemas'
import { errorMessage } from '@/services/api'

const SHOW_DEMO = import.meta.env.VITE_SHOW_DEMO_USERS === 'true'
const DEMO = [
  { role: 'Administrador', email: 'admin@tecnoandes.pe', password: 'Admin2026!' },
  { role: 'Analista', email: 'analista@tecnoandes.pe', password: 'Demo2026!' },
  { role: 'Consulta', email: 'gerencia@tecnoandes.pe', password: 'Demo2026!' },
]

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(params.get('expired') ? 'Su sesión expiró. Ingrese nuevamente.' : null)
  const { register, handleSubmit, setValue, formState } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  if (user) return <Navigate to="/dashboard" replace />

  const onSubmit = async (d: LoginForm) => {
    setError(null)
    try {
      await login(d.email, d.password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-sidebar p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo />
        <div className="relative z-10 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight text-white">
            Ventas, inventario e indicadores <span className="text-accent">convertidos en matrices.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Sistema empresarial de TecnoAndes Distribuciones: cinco sucursales, un catálogo tecnológico y un motor de
            álgebra lineal en Python + NumPy que transforma los datos del negocio en resultados analíticos.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-3"><Grid3x3 className="size-4 text-accent" /> Matrices sucursal × producto generadas desde las ventas</li>
            <li className="flex items-center gap-3"><BarChart3 className="size-4 text-accent" /> Ingresos = Q · p, brechas = A − T, índices por combinación lineal</li>
            <li className="flex items-center gap-3"><ShieldCheck className="size-4 text-accent" /> Roles, JWT y auditoría de cada operación</li>
          </ul>
        </div>
        <div className="pointer-events-none absolute -bottom-10 -right-10 grid grid-cols-6 gap-3 opacity-20">
          {Array.from({ length: 36 }).map((_, i) => (
            <div key={i} className={`size-10 rounded-md ${i % 7 === 0 ? 'bg-accent' : 'bg-primary'}`} />
          ))}
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} MatrixFlow Enterprise</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo light={false} />
          </div>
          <h2 className="text-2xl font-semibold">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-muted">Ingrese con su cuenta corporativa.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
            {error && <ErrorBox message={error} />}
            <Field label="Correo electrónico" error={formState.errors.email?.message}>
              <div className="relative">
                <Mail className="absolute left-3 top-3 size-4 text-slate-400" />
                <Input type="email" autoComplete="email" className="pl-9" placeholder="usuario@tecnoandes.pe" {...register('email')} />
              </div>
            </Field>
            <Field label="Contraseña" error={formState.errors.password?.message}>
              <div className="relative">
                <Lock className="absolute left-3 top-3 size-4 text-slate-400" />
                <Input type="password" autoComplete="current-password" className="pl-9" {...register('password')} />
              </div>
            </Field>
            <Button type="submit" className="w-full" loading={formState.isSubmitting}>
              Ingresar
            </Button>
          </form>

          {SHOW_DEMO && (
            <div className="mt-8 rounded-lg border border-line bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Usuarios de demostración</p>
              <div className="space-y-1">
                {DEMO.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                    onClick={() => {
                      setValue('email', d.email)
                      setValue('password', d.password)
                    }}
                  >
                    <span className="font-medium">{d.role}</span>
                    <span className="text-muted">{d.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
