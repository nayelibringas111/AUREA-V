import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { KeyRound, Server } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Badge, Button, Card, Field, Input, PageHeader } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_LABELS } from '@/lib/utils'
import { passwordSchema, type PasswordForm } from '@/schemas'
import { api, API_URL, errorMessage } from '@/services/api'
import { authApi } from '@/services/endpoints'

export default function Configuracion() {
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
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<{ status: string; database: boolean; environment: string }>(API_URL.replace(/\/api\/v1$/, '') + '/health', { baseURL: '' }).then((r) => r.data),
  })
  const e = form.formState.errors
  return (
    <>
      <PageHeader title="Configuración" description="Parámetros de la cuenta y estado de los servicios." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><KeyRound className="size-4" /> Cambiar contraseña</span>} subtitle={`${user?.full_name} · ${ROLE_LABELS[user?.role.name ?? '']}`}>
          <form onSubmit={form.handleSubmit((d) => change.mutate(d))} className="space-y-4">
            <Field label="Contraseña actual" error={e.current_password?.message}><Input type="password" autoComplete="current-password" {...form.register('current_password')} /></Field>
            <Field label="Nueva contraseña" error={e.new_password?.message}><Input type="password" autoComplete="new-password" {...form.register('new_password')} /></Field>
            <Field label="Confirmar" error={e.confirm?.message}><Input type="password" autoComplete="new-password" {...form.register('confirm')} /></Field>
            <div className="flex justify-end"><Button type="submit" loading={change.isPending}>Actualizar</Button></div>
          </form>
        </Card>
        <Card title={<span className="flex items-center gap-2"><Server className="size-4" /> Estado del sistema</span>}>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">API</dt><dd className="font-mono text-xs">{API_URL}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Servicio</dt><dd><Badge tone={health.data?.status === 'ok' ? 'green' : 'amber'}>{health.data?.status ?? (health.isLoading ? 'consultando…' : 'sin respuesta')}</Badge></dd></div>
            <div className="flex justify-between"><dt className="text-muted">Base de datos (PostgreSQL)</dt><dd><Badge tone={health.data?.database ? 'green' : 'red'}>{health.data?.database ? 'conectada' : 'no disponible'}</Badge></dd></div>
            <div className="flex justify-between"><dt className="text-muted">Entorno</dt><dd>{health.data?.environment ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Stack</dt><dd className="text-right text-xs">React + TypeScript · FastAPI · NumPy · PostgreSQL</dd></div>
          </dl>
        </Card>
      </div>
    </>
  )
}
