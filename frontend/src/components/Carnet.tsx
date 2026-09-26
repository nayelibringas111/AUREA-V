import { Activity, BadgeCheck, Download, Fingerprint, MapPin, Printer, ScanFace, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui'
import { cn, dateOnly, dateTime, integer, ROLE_LABELS } from '@/lib/utils'
import type { Carnet as CarnetData, FaceMatch, LoginSession } from '@/types'

const DAY = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá']

function initials(name: string) {
  return name
    .replace(/\(.*\)/, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-xs">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value ?? '—'}</span>
    </div>
  )
}

export function sourceLabel(s: LoginSession | null) {
  if (!s || !s.location_source || s.location_source === 'none') return 'Ubicación no disponible'
  if (s.location_source === 'gps') return `GPS del dispositivo${s.accuracy_m ? ` (±${Math.round(s.accuracy_m)} m)` : ''}`
  return 'Estimada por IP (aproximada)'
}

export function Carnet({ data, match }: { data: CarnetData; match?: FaceMatch | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const s = data.current_session
  const act = data.activity_7d
  const maxDay = Math.max(1, ...act.map((d) => d.events + d.logins))
  const maxUser = Math.max(1, ...data.top_users.map((u) => u.events))

  const download = async () => {
    if (!ref.current) return
    setBusy(true)
    try {
      const { toPng } = await import('html-to-image')
      const url = await toPng(ref.current, { pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: true })
      const a = document.createElement('a')
      a.href = url
      a.download = `carnet-${data.code}.png`
      a.click()
    } catch {
      toast.error('No se pudo generar la imagen del carnet.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div ref={ref} className="carnet-print grid overflow-hidden rounded-2xl border border-line bg-white shadow-sm md:grid-cols-[320px_1fr]">
        {/* ------------------ Anverso: identificación ------------------ */}
        <div className="flex flex-col bg-white">
          <div className="bg-sidebar px-5 py-4 text-white">
            <div className="flex items-center gap-2">
              <img src="/favicon.svg" alt="" className="size-7" />
              <div className="leading-tight">
                <div className="text-xs font-bold tracking-wide">{data.company?.name?.toUpperCase() ?? 'MATRIXFLOW'}</div>
                <div className="text-[10px] text-slate-400">RUC {data.company?.ruc ?? '—'}</div>
              </div>
            </div>
            <div className="mt-3 text-[10px] font-semibold tracking-[0.25em] text-accent">CARNET DE ACCESO</div>
          </div>
          <div className="flex flex-1 flex-col items-center px-5 pb-5 pt-5 text-center">
            {data.user.photo ? (
              <img src={data.user.photo} alt="Foto" className="h-32 w-26 rounded-xl object-cover ring-4 ring-slate-100" style={{ width: 104 }} />
            ) : (
              <div className="flex h-32 w-26 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-3xl font-semibold text-white" style={{ width: 104 }}>
                {initials(data.user.full_name)}
              </div>
            )}
            <div className="mt-3 text-base font-semibold leading-tight">{data.user.full_name}</div>
            <div className="mt-1 inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-primary">{ROLE_LABELS[data.user.role]}</div>
            <div className="mt-4 w-full divide-y divide-slate-100 text-left">
              <Row label="DNI" value={<span className="font-mono">{data.user.dni ?? 'No registrado'}</span>} />
              <Row label="Correo" value={data.user.email} />
              <Row label="Código" value={<span className="font-mono">{data.code}</span>} />
              <Row label="Emitido" value={dateOnly(data.issued_at.slice(0, 10))} />
              <Row label="Válido hasta" value={dateOnly(data.valid_until)} />
            </div>
            <div className={cn('mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium', data.user.face_enrolled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>
              {data.user.face_enrolled ? <BadgeCheck className="size-3.5" /> : <ScanFace className="size-3.5" />}
              {data.user.face_enrolled ? 'Biometría facial registrada' : 'Biometría facial pendiente'}
            </div>
            <div className="mt-2 flex items-center gap-1 font-mono text-[10px] text-muted">
              <Fingerprint className="size-3" /> Verificación {data.verification}
            </div>
          </div>
        </div>

        {/* ------------------ Reverso: datos de auditoría ------------------ */}
        <div className="grid gap-5 border-t border-line bg-slate-50/60 p-5 md:border-l md:border-t-0 lg:grid-cols-2">
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><MapPin className="size-3.5" /> Ubicación del acceso</h4>
            <div className="rounded-xl border border-line bg-white p-3">
              <div className="text-sm font-semibold">{s?.district ?? '—'}{s?.department ? `, ${s.department}` : ''}</div>
              <div className="text-xs text-muted">{s?.address ?? 'Dirección no disponible'}</div>
              <div className="mt-2 divide-y divide-slate-100">
                <Row label="Departamento" value={s?.department} />
                <Row label="Provincia" value={s?.province} />
                <Row label="Distrito" value={s?.district} />
                <Row label="Fuente" value={sourceLabel(s)} />
                <Row label="Fecha y hora" value={dateTime(s?.created_at)} />
                <Row label="IP" value={<span className="font-mono">{s?.ip_address ?? '—'}</span>} />
                <Row
                  label="Método"
                  value={s?.method === 'face' ? `Facial${match ? ` · similitud ${match.similarity} %` : s.face_distance != null ? ` · d = ${s.face_distance}` : ''}` : s ? 'Contraseña' : '—'}
                />
              </div>
            </div>
          </section>

          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Activity className="size-3.5" /> Actividad de los últimos 7 días</h4>
            <div className="rounded-xl border border-line bg-white p-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                {([['Eventos', data.totals_7d.events], ['Accesos', data.totals_7d.logins], ['Operaciones', data.totals_7d.operations]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-slate-50 py-1.5">
                    <div className="num text-lg font-semibold">{integer(v)}</div>
                    <div className="text-[10px] text-muted">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex h-24 items-end gap-1.5" aria-label="Actividad diaria">
                {act.map((d) => {
                  const total = d.events + d.logins
                  return (
                    <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.events} eventos, ${d.logins} accesos, ${d.operations} operaciones`}>
                      <span className="num text-[9px] text-muted">{total || ''}</span>
                      <div className="w-full rounded-t bg-primary" style={{ height: `${(total / maxDay) * 64 + 2}px`, opacity: total ? 1 : 0.2 }} />
                      <span className="text-[10px] text-muted">{DAY[new Date(`${d.date}T12:00:00`).getDay()]}</span>
                    </div>
                  )
                })}
              </div>
              {data.modules_7d.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {data.modules_7d.slice(0, 5).map((m) => (
                    <span key={m.module} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{m.module} · {m.events}</span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Users className="size-3.5" /> Usuarios más activos (7 días)</h4>
            <div className="space-y-2 rounded-xl border border-line bg-white p-3">
              {data.top_users.length === 0 && <p className="text-xs text-muted">Sin actividad registrada.</p>}
              {data.top_users.map((u, i) => (
                <div key={u.user_id}>
                  <div className="flex justify-between text-xs">
                    <span className={cn('font-medium', u.user_id === data.user.id && 'text-primary')}>{i + 1}. {u.name}</span>
                    <span className="num text-muted">{u.events} ev · {u.operations} op</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className={cn('h-1.5 rounded-full', u.user_id === data.user.id ? 'bg-primary' : 'bg-slate-400')} style={{ width: `${(u.events / maxUser) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><MapPin className="size-3.5" /> Accesos anteriores</h4>
            <ul className="divide-y divide-slate-100 rounded-xl border border-line bg-white px-3">
              {data.recent_sessions.length === 0 && <li className="py-2 text-xs text-muted">Primer acceso registrado.</li>}
              {data.recent_sessions.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <span className="min-w-0 truncate">
                    {r.district ?? (r.department ? '' : 'Ubicación no disponible')}{r.department ? `${r.district ? ', ' : ''}${r.department}` : ''}
                    <span className="ml-1 text-muted">· {r.method === 'face' ? 'facial' : 'contraseña'}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-muted">{dateTime(r.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      <div className="no-print flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="secondary" icon={<Printer className="size-3.5" />} onClick={() => window.print()}>Imprimir / PDF</Button>
        <Button size="sm" icon={<Download className="size-3.5" />} loading={busy} onClick={download}>Descargar PNG</Button>
      </div>
    </div>
  )
}
