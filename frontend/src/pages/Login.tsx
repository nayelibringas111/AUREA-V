import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BarChart3, CreditCard, Grid3x3, IdCard, KeyRound, Lock, Mail, MapPin, ScanFace, ShieldCheck, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Carnet } from '@/components/Carnet'
import { FaceScanner, type ScanResult } from '@/components/FaceScanner'
import { Logo } from '@/components/layout/AppLayout'
import { Button, ErrorBox, Field, Input, Spinner } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getBrowserLocation, type GeoPoint } from '@/lib/geo'
import { cn } from '@/lib/utils'
import { loginSchema, type LoginForm } from '@/schemas'
import { errorMessage, tokenStore } from '@/services/api'
import { authApi } from '@/services/endpoints'
import type { Carnet as CarnetData, FaceMatch } from '@/types'

const SHOW_DEMO = import.meta.env.VITE_SHOW_DEMO_USERS === 'true'
const DEMO = [
  { role: 'Administrador', email: 'admin@tecnoandes.pe', password: 'Admin2026!', dni: '70000001' },
  { role: 'Analista', email: 'analista@tecnoandes.pe', password: 'Demo2026!', dni: '70000002' },
  { role: 'Consulta', email: 'gerencia@tecnoandes.pe', password: 'Demo2026!', dni: '70000003' },
]

type Method = 'face' | 'password'
type Stage = 'form' | 'scan' | 'verifying' | 'verified'

function PasswordLogin({ onError }: { onError: (m: string | null) => void }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { register, handleSubmit, setValue, formState } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })
  const onSubmit = async (d: LoginForm) => {
    onError(null)
    try {
      const geo = await getBrowserLocation(5000)
      await login(d.email, d.password, geo)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true })
    } catch (e) {
      onError(errorMessage(e))
    }
  }
  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>Ingresar</Button>
      </form>
      {SHOW_DEMO && (
        <div className="mt-6 rounded-lg border border-line bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Usuarios de demostración</p>
          {DEMO.map((d) => (
            <button key={d.email} type="button" className="flex w-full justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50"
              onClick={() => { setValue('email', d.email); setValue('password', d.password) }}>
              <span className="font-medium">{d.role}</span>
              <span className="text-muted">{d.email}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export default function LoginPage() {
  const { user, loginWithFace } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [method, setMethod] = useState<Method>('face')
  const [stage, setStage] = useState<Stage>('form')
  const [dni, setDni] = useState('')
  const [error, setError] = useState<string | null>(params.get('expired') ? 'Su sesión expiró. Ingrese nuevamente.' : null)
  const [carnet, setCarnet] = useState<CarnetData | null>(null)
  const [match, setMatch] = useState<FaceMatch | null>(null)
  const geo = useRef<Promise<GeoPoint | null> | null>(null)

  // Al completar los 8 dígitos del DNI se inicia el escaneo facial automáticamente
  useEffect(() => {
    if (method === 'face' && stage === 'form' && /^\d{8}$/.test(dni)) {
      setError(null)
      geo.current = getBrowserLocation(7000) // se pide en paralelo al escaneo
      setStage('scan')
    }
  }, [dni, method, stage])

  if (user && stage === 'form') return <Navigate to="/dashboard" replace />

  const onScan = async (r: ScanResult) => {
    setStage('verifying')
    try {
      const location = geo.current ? await geo.current : null
      const res = await loginWithFace({ dni, descriptor: r.descriptor, liveness: r.liveness, brightness: r.brightness, location })
      setMatch(res.match)
      setCarnet(await authApi.carnet())
      setStage('verified')
    } catch (e) {
      tokenStore.clear()
      setError(errorMessage(e))
      setStage('form')
      setDni('')
    }
  }

  const enter = async () => {
    qc.setQueryData(['me'], await authApi.me())
    navigate('/dashboard', { replace: true })
  }

  if (stage === 'verified' && carnet) {
    return (
      <div className="min-h-full bg-bg px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Logo light={false} />
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
              <ShieldCheck className="size-4" /> Identidad verificada{match ? ` · similitud ${match.similarity} %` : ''}
            </div>
          </div>
          <h1 className="text-2xl font-semibold">Bienvenido(a), {carnet.user.full_name.split(' (')[0]}</h1>
          <p className="mb-5 mt-1 text-sm text-muted">Estos son sus datos registrados y su actividad reciente.</p>
          <Carnet data={carnet} match={match} />
          <div className="mt-6 flex justify-end">
            <Button onClick={enter} icon={<ArrowRight className="size-4" />}>Ingresar al sistema</Button>
          </div>
        </div>
      </div>
    )
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
            Sistema empresarial de TecnoAndes Distribuciones con motor de álgebra lineal en Python + NumPy.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-3"><ScanFace className="size-4 text-accent" /> Acceso con DNI y reconocimiento facial</li>
            <li className="flex items-center gap-3"><IdCard className="size-4 text-accent" /> Carnet con su actividad y ubicación de acceso</li>
            <li className="flex items-center gap-3"><Grid3x3 className="size-4 text-accent" /> Matrices sucursal × producto desde las ventas</li>
            <li className="flex items-center gap-3"><BarChart3 className="size-4 text-accent" /> Ingresos = Q · p, brechas = A − T, índices ponderados</li>
          </ul>
        </div>
        <div className="pointer-events-none absolute -bottom-10 -right-10 grid grid-cols-6 gap-3 opacity-20">
          {Array.from({ length: 36 }).map((_, i) => <div key={i} className={`size-10 rounded-md ${i % 7 === 0 ? 'bg-accent' : 'bg-primary'}`} />)}
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} MatrixFlow Enterprise</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo light={false} /></div>
          <h2 className="text-2xl font-semibold">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-muted">Identifíquese con su DNI y su rostro, o con su correo.</p>

          <div className="mt-6 grid grid-cols-2 rounded-lg border border-line bg-white p-1" role="tablist">
            {([['face', 'DNI + rostro', <ScanFace key="f" className="size-4" />], ['password', 'Correo y contraseña', <KeyRound key="k" className="size-4" />]] as const).map(([m, label, icon]) => (
              <button key={m} role="tab" aria-selected={method === m}
                onClick={() => { setMethod(m); setStage('form'); setError(null) }}
                className={cn('flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors', method === m ? 'bg-primary text-white' : 'text-muted hover:text-ink')}>
                {icon} {label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            {error && <ErrorBox message={error} />}
            {method === 'password' && <PasswordLogin onError={setError} />}

            {method === 'face' && stage === 'form' && (
              <>
                <Field label="Número de DNI" hint="Al completar los 8 dígitos se activará la cámara.">
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-3 size-4 text-slate-400" />
                    <Input inputMode="numeric" autoComplete="off" maxLength={8} autoFocus value={dni}
                      onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      className="pl-9 font-mono text-lg tracking-[0.3em]" placeholder="00000000" aria-label="DNI" />
                  </div>
                </Field>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="mb-1 flex items-center gap-1.5 font-semibold"><Sun className="size-3.5" /> Antes de escanear</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    <li>Ubíquese frente a una fuente de luz (ventana o lámpara), no detrás de usted.</li>
                    <li>Retire lentes oscuros, gorra o mascarilla.</li>
                    <li>Mire de frente y parpadee con normalidad.</li>
                  </ul>
                  <p className="mt-2 flex items-center gap-1.5"><MapPin className="size-3.5" /> Se solicitará su ubicación para registrar el acceso.</p>
                </div>
                {SHOW_DEMO && (
                  <p className="text-xs text-muted">
                    DNI de demostración: {DEMO.map((d) => `${d.dni} (${d.role})`).join(' · ')}. Primero registre su rostro en <b>Configuración → Reconocimiento facial</b>.
                  </p>
                )}
              </>
            )}

            {method === 'face' && stage === 'scan' && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span>DNI <b className="font-mono">{dni}</b></span>
                  <button className="text-xs text-primary hover:underline" onClick={() => { setStage('form'); setDni('') }}>Cambiar DNI</button>
                </div>
                <FaceScanner mode="login" onComplete={onScan} onCancel={() => { setStage('form'); setDni('') }} />
              </>
            )}
            {method === 'face' && stage === 'verifying' && <Spinner label="Verificando identidad y ubicación…" />}
          </div>
        </div>
      </div>
    </div>
  )
}
