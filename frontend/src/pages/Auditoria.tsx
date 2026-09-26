import { useQuery } from '@tanstack/react-query'
import { Activity, List, MapPin, ScanFace, Users } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { sourceLabel } from '@/components/Carnet'
import { axisProps, ChartTooltip, INK, Legend, SERIES } from '@/components/charts'
import { ModuleTabs, useTab } from '@/components/ModuleTabs'
import { Badge, Card, ErrorBox, PageHeader, Pagination, Select, Spinner, StatCard, Table, Td, Th } from '@/components/ui'
import { dateTime, integer, ROLE_LABELS } from '@/lib/utils'
import { errorMessage } from '@/services/api'
import { auditApi } from '@/services/endpoints'

const MODULES = ['auth', 'usuarios', 'empresa', 'sucursales', 'productos', 'ventas', 'inventario', 'metas', 'vectores', 'matrices', 'operaciones', 'sistema']
const TABS = ['eventos', 'accesos', 'actividad', 'usuarios'] as const

function Eventos() {
  const [f, setF] = useState<{ module?: string; status?: string; page: number; size: number }>({ page: 1, size: 25 })
  const { data, isLoading, error } = useQuery({ queryKey: ['audit', f], queryFn: () => auditApi.list(f), placeholderData: (p) => p })
  return (
    <Card>
      <div className="mb-4 flex flex-wrap gap-3">
        <Select className="w-48" value={f.module ?? ''} onChange={(e) => setF({ ...f, module: e.target.value || undefined, page: 1 })} aria-label="Módulo">
          <option value="">Todos los módulos</option>
          {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Select className="w-40" value={f.status ?? ''} onChange={(e) => setF({ ...f, status: e.target.value || undefined, page: 1 })} aria-label="Estado">
          <option value="">Todos</option>
          <option value="success">Éxito</option>
          <option value="error">Error</option>
        </Select>
      </div>
      {isLoading && <Spinner />}
      {error && <ErrorBox message={errorMessage(error)} />}
      {data && (
        <>
          <Table>
            <thead><tr><Th>Fecha</Th><Th>Usuario</Th><Th>Módulo</Th><Th>Acción</Th><Th>Entidad</Th><Th>IP</Th><Th>Estado</Th><Th>Detalle</Th></tr></thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id}>
                  <Td className="text-xs text-muted">{dateTime(l.created_at)}</Td>
                  <Td className="text-xs">{l.user_email ?? '—'}</Td>
                  <Td><Badge>{l.module}</Badge></Td>
                  <Td>{l.action}</Td>
                  <Td className="font-mono text-xs">{l.entity_id ?? ''}</Td>
                  <Td className="font-mono text-xs text-muted">{l.ip_address ?? ''}</Td>
                  <Td><Badge tone={l.status === 'success' ? 'green' : 'red'}>{l.status}</Badge></Td>
                  <Td className="max-w-xs truncate font-mono text-[11px] text-muted">{l.detail ? JSON.stringify(l.detail) : ''}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={data.page} size={data.size} total={data.total} onPage={(page) => setF({ ...f, page })} />
        </>
      )}
    </Card>
  )
}

function Accesos() {
  const [f, setF] = useState<{ method?: string; status?: string; page: number; size: number }>({ page: 1, size: 20 })
  const sessions = useQuery({ queryKey: ['sessions', f], queryFn: () => auditApi.sessions(f), placeholderData: (p) => p })
  const places = useQuery({ queryKey: ['locations'], queryFn: () => auditApi.locations(30) })
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card title="Inicios de sesión" subtitle="Método, resultado y ubicación de cada acceso" className="xl:col-span-2">
        <div className="mb-4 flex flex-wrap gap-3">
          <Select className="w-52" value={f.method ?? ''} onChange={(e) => setF({ ...f, method: e.target.value || undefined, page: 1 })} aria-label="Método">
            <option value="">Todos los métodos</option>
            <option value="face">Facial (DNI)</option>
            <option value="password">Contraseña</option>
          </Select>
          <Select className="w-40" value={f.status ?? ''} onChange={(e) => setF({ ...f, status: e.target.value || undefined, page: 1 })} aria-label="Resultado">
            <option value="">Todos</option>
            <option value="success">Exitosos</option>
            <option value="error">Fallidos</option>
          </Select>
        </div>
        {sessions.isLoading && <Spinner />}
        {sessions.data && (
          <>
            <Table>
              <thead><tr><Th>Fecha</Th><Th>Usuario</Th><Th>Método</Th><Th>Ubicación</Th><Th>Resultado</Th></tr></thead>
              <tbody>
                {sessions.data.items.map((s) => (
                  <tr key={s.id}>
                    <Td className="text-xs text-muted">{dateTime(s.created_at)}</Td>
                    <Td className="text-xs">{s.user ?? s.identifier}</Td>
                    <Td>{s.method === 'face' ? <Badge tone="cyan"><ScanFace className="mr-1 size-3" />Facial</Badge> : <Badge>Contraseña</Badge>}</Td>
                    <Td>
                      <div className="text-sm">{s.district ?? '—'}{s.department ? `, ${s.department}` : ''}</div>
                      <div className="max-w-64 truncate text-[11px] text-muted">{s.address ?? sourceLabel(s)}</div>
                    </Td>
                    <Td>
                      <Badge tone={s.status === 'success' ? 'green' : 'red'}>{s.status === 'success' ? 'Exitoso' : 'Fallido'}</Badge>
                      {s.reason && <div className="mt-0.5 text-[10px] text-muted">{s.reason}</div>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={sessions.data.page} size={sessions.data.size} total={sessions.data.total} onPage={(page) => setF({ ...f, page })} />
          </>
        )}
      </Card>
      <Card title={<span className="flex items-center gap-2"><MapPin className="size-4" /> Accesos por ubicación</span>} subtitle="Últimos 30 días">
        {places.isLoading && <Spinner />}
        <ul className="divide-y divide-slate-100">
          {places.data?.map((p) => (
            <li key={p.department + p.district} className="flex items-center justify-between py-2 text-sm">
              <span>{p.district}<span className="text-muted"> · {p.department}</span></span>
              <Badge tone="blue">{p.logins}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function Actividad() {
  const { data, isLoading } = useQuery({ queryKey: ['activity', 7], queryFn: () => auditApi.activity(7) })
  if (isLoading || !data) return <Spinner />
  const rows = data.map((d) => ({ ...d, label: new Date(`${d.date}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit' }) }))
  const tot = (k: 'events' | 'logins' | 'operations') => data.reduce((a, d) => a + d[k], 0)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Eventos (7 días)" value={integer(tot('events'))} />
        <StatCard label="Accesos exitosos" value={integer(tot('logins'))} tone="green" />
        <StatCard label="Operaciones" value={integer(tot('operations'))} tone="accent" />
      </div>
      <Card title="Actividad diaria" actions={<Legend items={[{ label: 'Eventos', color: SERIES[0] }, { label: 'Accesos', color: SERIES[1] }, { label: 'Operaciones', color: SERIES[2] }]} />}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={rows} barGap={2}>
              <CartesianGrid vertical={false} stroke={INK.grid} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} allowDecimals={false} width={40} />
              <Tooltip content={<ChartTooltip format={(v) => integer(v)} />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="events" name="Eventos" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="logins" name="Accesos" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="operations" name="Operaciones" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

function UsuariosActivos() {
  const { data, isLoading } = useQuery({ queryKey: ['top-users', 7], queryFn: () => auditApi.topUsers(7) })
  if (isLoading || !data) return <Spinner />
  const max = Math.max(1, ...data.map((u) => u.events))
  return (
    <Card title="Usuarios más activos" subtitle="Eventos de auditoría y operaciones de los últimos 7 días">
      <Table>
        <thead><tr><Th>#</Th><Th>Usuario</Th><Th>Rol</Th><Th className="w-1/3">Actividad</Th><Th className="text-right">Eventos</Th><Th className="text-right">Operaciones</Th></tr></thead>
        <tbody>
          {data.map((u, i) => (
            <tr key={u.user_id}>
              <Td className="font-semibold">{i + 1}</Td>
              <Td className="font-medium">{u.name}</Td>
              <Td><Badge>{ROLE_LABELS[u.role]}</Badge></Td>
              <Td><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-primary" style={{ width: `${(u.events / max) * 100}%` }} /></div></Td>
              <Td className="num text-right">{integer(u.events)}</Td>
              <Td className="num text-right">{integer(u.operations)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}

export default function Auditoria() {
  const [tab, setTab] = useTab(TABS, 'eventos')
  return (
    <>
      <PageHeader title="Auditoría" description="Trazabilidad por secciones: eventos del sistema, accesos con ubicación, actividad semanal y usuarios más activos." />
      <ModuleTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'eventos', label: 'Eventos', icon: <List className="size-4" /> },
          { value: 'accesos', label: 'Accesos y ubicación', icon: <MapPin className="size-4" /> },
          { value: 'actividad', label: 'Actividad 7 días', icon: <Activity className="size-4" /> },
          { value: 'usuarios', label: 'Usuarios más activos', icon: <Users className="size-4" /> },
        ]}
      />
      {tab === 'eventos' && <Eventos />}
      {tab === 'accesos' && <Accesos />}
      {tab === 'actividad' && <Actividad />}
      {tab === 'usuarios' && <UsuariosActivos />}
    </>
  )
}
