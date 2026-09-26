import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, Boxes, Coins, LayoutDashboard, Percent, ShoppingCart, Sigma, Target } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps, ChartTooltip, INK, Legend, SERIES, TARGET_GRAY } from '@/components/charts'
import { ModuleTabs, useTab } from '@/components/ModuleTabs'
import { Badge, Card, ErrorBox, PageHeader, Select, Spinner, StatCard, Table, Td, Th } from '@/components/ui'
import { errorMessage } from '@/services/api'
import { reportApi } from '@/services/endpoints'
import { currentPeriod, dateTime, integer, lastPeriods, money, moneyShort, monthLabel, number, OPERATION_LABELS, pct, periodRange } from '@/lib/utils'

const TABS = ['resumen', 'ventas', 'inventario', 'actividad'] as const

/* Cada pestaña consulta solo su propio endpoint: el módulo no carga todo a la vez. */

function Resumen({ period }: { period: string }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['kpis', period], queryFn: () => reportApi.kpis(period) })
  if (isLoading) return <Spinner />
  if (error) return <ErrorBox message={errorMessage(error)} />
  if (!data) return null
  const k = data.kpis
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ingresos" value={moneyShort(k.revenue)} hint={`${integer(k.sales_count)} ventas · ticket ${money(k.avg_ticket)}`} icon={<Coins className="size-4" />} />
        <StatCard label="Margen bruto" value={moneyShort(k.gross_margin)} hint={`${pct(k.margin_pct)} sobre ventas`} icon={<Percent className="size-4" />} tone="green" />
        <StatCard label="Cumplimiento de metas" value={pct(k.compliance_pct)} hint="(A·1) / (T·1)" icon={<Target className="size-4" />} tone="accent" />
        <StatCard label="Stock bajo" value={integer(k.low_stock)} hint={`${integer(k.units)} unidades vendidas`} icon={<AlertTriangle className="size-4" />} tone={k.low_stock > 0 ? 'amber' : 'green'} />
      </div>
      <Card title="Ventas vs. meta por sucursal" subtitle="Real = A·1 · Meta = T·1"
        actions={<Legend items={[{ label: 'Real', color: SERIES[0] }, { label: 'Meta', color: TARGET_GRAY }]} />}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={data.compliance_by_branch} barGap={2} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} stroke={INK.grid} />
              <XAxis dataKey="branch" {...axisProps} tickFormatter={(v: string) => v.replace('Sede ', '')} />
              <YAxis {...axisProps} tickFormatter={(v: number) => moneyShort(v)} width={70} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="actual" name="Real" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="target" name="Meta" fill={TARGET_GRAY} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

function Ventas({ period }: { period: string }) {
  const range = periodRange(period)
  const byProduct = useQuery({ queryKey: ['sales-by-product', period], queryFn: () => reportApi.salesByProduct(range.date_from, range.date_to) })
  const byBranch = useQuery({ queryKey: ['sales-by-branch', period], queryFn: () => reportApi.salesByBranch(range.date_from, range.date_to) })
  const trend = useQuery({ queryKey: ['trend', 6], queryFn: () => reportApi.trend(6) })
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card title="Tendencia mensual de ventas" subtitle="Últimos 6 meses" className="lg:col-span-3">
        {trend.isLoading ? <Spinner /> : (
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend.data?.items.map((m) => ({ ...m, label: monthLabel(m.period) }))} margin={{ left: 8, right: 16, top: 8 }}>
                <CartesianGrid vertical={false} stroke={INK.grid} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v: number) => moneyShort(v)} width={70} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="amount" name="Ventas" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Card title="Participación por producto" subtitle={byProduct.data?.formula} className="lg:col-span-2">
        {byProduct.isLoading && <Spinner />}
        <div className="space-y-3">
          {[...(byProduct.data?.items ?? [])].sort((a, b) => b.amount - a.amount).map((p) => (
            <div key={p.product}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium">{p.product}</span>
                <span className="num text-muted">{money(p.amount)} · {pct(p.share)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-primary" style={{ width: `${p.share}%` }} /></div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Ventas por sucursal" subtitle={byBranch.data?.formula} className="lg:col-span-5">
        {byBranch.isLoading && <Spinner />}
        {byBranch.data && (
          <Table>
            <thead><tr><Th>Sucursal</Th><Th className="text-right">Unidades</Th><Th className="text-right">Importe</Th><Th className="text-right">Participación</Th></tr></thead>
            <tbody>
              {byBranch.data.items.map((b) => (
                <tr key={b.branch}><Td className="font-medium">{b.branch}</Td><Td className="num text-right">{integer(b.units)}</Td><Td className="num text-right">{money(b.amount)}</Td><Td className="num text-right">{pct(b.share)}</Td></tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function Inventario() {
  const { data, isLoading } = useQuery({ queryKey: ['rotation', 30], queryFn: () => reportApi.rotation(30) })
  if (isLoading || !data) return <Spinner />
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Rotación por producto" subtitle={`Últimos 30 días · ${data.formula.split(';')[0]}`}>
        <Table>
          <thead><tr><Th>Producto</Th><Th className="text-right">Stock</Th><Th className="text-right">Vendido</Th><Th className="text-right">Rotación</Th></tr></thead>
          <tbody>
            {data.by_product.map((r) => (
              <tr key={r.product}><Td className="font-medium">{r.product}</Td><Td className="num text-right">{integer(r.stock)}</Td><Td className="num text-right">{integer(r.sold)}</Td><Td className="num text-right">{r.rotation.toFixed(2)}</Td></tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card title="Alertas de stock bajo" subtitle="Existencias ≤ stock mínimo">
        {data.alerts.length === 0 ? <p className="text-sm text-muted">Sin alertas.</p> : (
          <ul className="divide-y divide-slate-100">
            {data.alerts.map((r) => (
              <li key={r.branch + r.product} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" aria-label="Alerta" />{r.product} · <span className="text-muted">{r.branch}</span></span>
                <Badge tone="amber">{r.stock} / mín. {r.min_stock}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Actividad() {
  const recent = useQuery({ queryKey: ['recent-activity'], queryFn: () => reportApi.recentActivity(12) })
  const ops = useQuery({ queryKey: ['ops-stats'], queryFn: reportApi.operations })
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Actividad reciente">
        {recent.isLoading && <Spinner />}
        <ul className="divide-y divide-slate-100">
          {recent.data?.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate"><span className="font-medium">{a.module}</span> <span className="text-muted">· {a.action} · {a.user}</span></span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge tone={a.status === 'success' ? 'green' : 'red'}>{a.status === 'success' ? 'OK' : 'Error'}</Badge>
                <span className="text-xs text-muted">{dateTime(a.created_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={<span className="flex items-center gap-2"><Sigma className="size-4" /> Indicadores de procesamiento</span>}
        subtitle={ops.data ? `${integer(ops.data.total)} operaciones · éxito ${pct(ops.data.success_rate)}` : undefined}>
        {ops.isLoading && <Spinner />}
        {ops.data && (
          <Table>
            <thead><tr><Th>Operación</Th><Th className="text-right">Éxito</Th><Th className="text-right">Error</Th><Th className="text-right">Tiempo medio</Th></tr></thead>
            <tbody>
              {ops.data.by_type.map((t) => (
                <tr key={t.operation_type}><Td>{OPERATION_LABELS[t.operation_type]}</Td><Td className="num text-right">{t.success}</Td><Td className="num text-right">{t.error}</Td><Td className="num text-right">{number(t.avg_ms)} ms</Td></tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState(currentPeriod())
  const [tab, setTab] = useTab(TABS, 'resumen')
  return (
    <>
      <PageHeader
        title="Dashboard ejecutivo"
        description="Indicadores de TecnoAndes calculados a partir de las matrices de ventas (A), cantidades (Q), metas (T) y existencias (S)."
        actions={
          (tab === 'resumen' || tab === 'ventas') && (
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-56" aria-label="Periodo">
              {lastPeriods(7).map((p) => <option key={p} value={p}>{monthLabel(p)} {p === currentPeriod() ? '(en curso)' : ''}</option>)}
            </Select>
          )
        }
      />
      <ModuleTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'resumen', label: 'Resumen', icon: <LayoutDashboard className="size-4" /> },
          { value: 'ventas', label: 'Ventas', icon: <ShoppingCart className="size-4" /> },
          { value: 'inventario', label: 'Inventario', icon: <Boxes className="size-4" /> },
          { value: 'actividad', label: 'Actividad', icon: <Activity className="size-4" /> },
        ]}
      />
      {tab === 'resumen' && <Resumen period={period} />}
      {tab === 'ventas' && <Ventas period={period} />}
      {tab === 'inventario' && <Inventario />}
      {tab === 'actividad' && <Actividad />}
    </>
  )
}
