import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, KeyRound, ScanFace, Server, Trash2, UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FaceEnroll } from '@/components/FaceEnroll'
import { ModuleTabs, useTab } from '@/components/ModuleTabs'
import { Badge, Button, Card, Field, Input, PageHeader, Spinner } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { dateTime, ROLE_LABELS } from '@/lib/utils'
import { passwordSchema, type PasswordForm } from '@/schemas'
import { api, API_URL, errorMessage } from '@/services/api'
import { authApi, userApi } from '@/services/endpoints'
import type { User } from '@/types'

const TABS = ['cuenta', 'rostro', 'sistema'] as const

function Cuenta() {
  const { user } = useAuth()
  const form = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })
  const change = useMutation({
    mutationFn: (d: PasswordForm) => authApi.changePassword(d.current_password, d.new_password),
    onSuccess: () => {
      toast.success('Contraseña actualizada')
      form.reset({ current_password: '', new_password: '', confirm: '' })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const e = form.formState.errors
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Datos de la cuenta">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Nombre</dt><dd className="font-medium">{user?.full_name}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Correo</dt><dd>{user?.email}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">DNI</dt><dd className="font-mono">{user?.dni ?? 'No registrado (solicítelo al administrador)'}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Rol</dt><dd><Badge tone="blue">{ROLE_LABELS[user?.role.name ?? '']}</Badge></dd></div>
          <div className="flex justify-between"><dt className="text-muted">Último acceso</dt><dd>{dateTime(user?.last_login)}</dd></div>
        </dl>
      </Card>
      <Card title={<span className="flex items-center gap-2"><KeyRound className="size-4" /> Cambiar contraseña</span>}>
        <form onSubmit={form.handleSubmit((d) => change.mutate(d))} className="space-y-4">
          <Field label="Contraseña actual" error={e.current_password?.message}><Input type="password" autoComplete="current-password" {...form.register('current_password')} /></Field>
          <Field label="Nueva contraseña" error={e.new_password?.message}><Input type="password" autoComplete="new-password" {...form.register('new_password')} /></Field>
          <Field label="Confirmar" error={e.confirm?.message}><Input type="password" autoComplete="new-password" {...form.register('confirm')} /></Field>
          <div className="flex justify-end"><Button type="submit" loading={change.isPending}>Actualizar</Button></div>
        </form>
      </Card>
    </div>
  )
}

function Rostro() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const setMe = (u: User) => qc.setQueryData(['me'], { ...user, ...u })
  const remove = useMutation({
    mutationFn: userApi.deleteMyFace,
    onSuccess: () => {
      toast.success('Biometría eliminada')
      setMe({ ...(user as User), face_enrolled: false, face_enrolled_at: null })
      qc.invalidateQueries({ queryKey: ['carnet'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  if (!user) return <Spinner />
  return (
    <Card title={<span className="flex items-center gap-2"><ScanFace className="size-4" /> Reconocimiento facial</span>} subtitle="Permite ingresar con su DNI y su rostro, sin contraseña.">
      {!user.dni ? (
        <p className="text-sm text-amber-800">Su cuenta no tiene DNI registrado. Pida al administrador que lo agregue en el módulo Usuarios.</p>
      ) : user.face_enrolled ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <BadgeCheck className="size-5" />
            <div>
              <p className="font-medium">Rostro registrado</p>
              <p className="text-xs">Desde {dateTime(user.face_enrolled_at)} · DNI {user.dni}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="danger" icon={<Trash2 className="size-4" />} loading={remove.isPending}
              onClick={() => confirm('¿Eliminar sus datos biométricos?') && remove.mutate()}>Eliminar biometría</Button>
          </div>
          <p className="text-xs text-muted">Para volver a registrarse (por ejemplo, si cambió su apariencia), elimine la biometría y repita el escaneo.</p>
        </div>
      ) : (
        <div className="max-w-xl">
          <FaceEnroll submit={userApi.enrollMe} onDone={(u) => { setMe(u); qc.invalidateQueries({ queryKey: ['carnet'] }) }} />
        </div>
      )}
    </Card>
  )
}

function Sistema() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<{ status: string; database: boolean; environment: string }>(API_URL.replace(/\/api\/v1$/, '') + '/health', { baseURL: '' }).then((r) => r.data),
  })
  return (
    <Card title={<span className="flex items-center gap-2"><Server className="size-4" /> Estado del sistema</span>}>
      <dl className="max-w-xl space-y-3 text-sm">
        <div className="flex justify-between"><dt className="text-muted">API</dt><dd className="font-mono text-xs">{API_URL}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Servicio</dt><dd><Badge tone={health.data?.status === 'ok' ? 'green' : 'amber'}>{health.data?.status ?? (health.isLoading ? 'consultando…' : 'sin respuesta')}</Badge></dd></div>
        <div className="flex justify-between"><dt className="text-muted">Base de datos (PostgreSQL)</dt><dd><Badge tone={health.data?.database ? 'green' : 'red'}>{health.data?.database ? 'conectada' : 'no disponible'}</Badge></dd></div>
        <div className="flex justify-between"><dt className="text-muted">Entorno</dt><dd>{health.data?.environment ?? '—'}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Stack</dt><dd className="text-right text-xs">React + TypeScript · FastAPI · NumPy · PostgreSQL · face-api</dd></div>
      </dl>
    </Card>
  )
}

export default function Configuracion() {
  const [tab, setTab] = useTab(TABS, 'cuenta')
  return (
    <>
      <PageHeader title="Configuración" description="Cuenta, biometría y estado de los servicios." />
      <ModuleTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'cuenta', label: 'Mi cuenta', icon: <UserRound className="size-4" /> },
          { value: 'rostro', label: 'Reconocimiento facial', icon: <ScanFace className="size-4" /> },
          { value: 'sistema', label: 'Sistema', icon: <Server className="size-4" /> },
        ]}
      />
      {tab === 'cuenta' && <Cuenta />}
      {tab === 'rostro' && <Rostro />}
      {tab === 'sistema' && <Sistema />}
    </>
  )
}
