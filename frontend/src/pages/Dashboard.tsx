import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Coins, Percent, ShoppingCart, Sigma, Target, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps, ChartTooltip, INK, Legend, SERIES, TARGET_GRAY } from '@/components/charts'
import { Badge, Card, ErrorBox, PageHeader, Select, Spinner, StatCard, Table, Td, Th } from '@/components/ui'
import { errorMessage } from '@/services/api'
import { reportApi } from '@/services/endpoints'
import { currentPeriod, dateTime, integer, lastPeriods, money, moneyShort, monthLabel, pct } from '@/lib/utils'

export default function Dashboard() {
  const [period, setPeriod] = useState(currentPeriod())
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard', period], queryFn: () => reportApi.dashboard(period) })

  return (
    <>
      <PageHeader
        title="Dashboard ejecutivo"
        description="Indicadores de TecnoAndes calculados a partir de las matrices de ventas (A), cantidades (Q), metas (T) y existencias (S)."
        actions={
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-56" aria-label="Periodo">
            {lastPeriods(7).map((p) => (
              <option key={p} value={p}>
                {monthLabel(p)} {p === currentPeriod() ? '(en curso)' : ''}
              </option>
            ))}
          </Select>
        }
      />
      {isLoading && <Spinner />}
      {error && <ErrorBox message={errorMessage(error)} />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Ingresos" value={moneyShort(data.kpis.revenue)} hint={`${integer(data.kpis.sales_count)} ventas · ticket ${money(data.kpis.avg_ticket)}`} icon={<Coins className="size-4" />} />
            <StatCard label="Margen bruto" value={moneyShort(data.kpis.gross_margin)} hint={`${pct(data.kpis.margin_pct)} sobre ventas`} icon={<Percent className="size-4" />} tone="green" />
            <StatCard label="Cumplimiento de metas" value={pct(data.kpis.compliance_pct)} hint="(A·1) / (T·1)" icon={<Target className="size-4" />} tone="accent" />
            <StatCard
              label="Stock bajo"
              value={integer(data.kpis.low_stock)}
              hint={`${integer(data.kpis.units)} unidades vendidas`}
              icon={<AlertTriangle className="size-4" />}
              tone={data.kpis.low_stock > 0 ? 'amber' : 'green'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card title="Ventas vs. meta por sucursal" subtitle="Real = A·1 · Meta = T·1" className="lg:col-span-3"
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
            <Card title="Participación por producto" subtitle="Aᵀ·1 — importe vendido en el periodo" className="lg:col-span-2">
              <div className="space-y-3">
                {[...data.sales_by_product].sort((a, b) => b.amount - a.amount).map((p) => (
                  <div key={p.product}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium">{p.product}</span>
                      <span className="num text-muted">
                        {money(p.amount)} · {pct(p.share)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${p.share}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card title="Tendencia mensual de ventas" subtitle="Últimos 6 meses" className="lg:col-span-3">
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={data.monthly_trend.map((m) => ({ ...m, label: monthLabel(m.period) }))} margin={{ left: 8, right: 16, top: 8 }}>
                    <CartesianGrid vertical={false} stroke={INK.grid} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={(v: number) => moneyShort(v)} width={70} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="amount" name="Ventas" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Inventario y rotación" subtitle="Últimos 30 días · rotación = Q / (S + Q/2)" className="lg:col-span-2">
              <Table>
                <thead>
                  <tr>
                    <Th>Producto</Th>
                    <Th className="text-right">Stock</Th>
                    <Th className="text-right">Vendido</Th>
                    <Th className="text-right">Rotación</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.inventory_by_product.map((r) => (
                    <tr key={r.product}>
                      <Td className="font-medium">{r.product}</Td>
                      <Td className="num text-right">{integer(r.stock)}</Td>
                      <Td className="num text-right">{integer(r.sold)}</Td>
                      <Td className="num text-right">{r.rotation.toFixed(2)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Alertas de stock bajo" subtitle="Existencias ≤ stock mínimo">
              {data.low_stock.length === 0 ? (
                <p className="text-sm text-muted">Sin alertas: todas las existencias superan el mínimo.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.low_stock.map((r) => (
                    <li key={r.branch + r.product} className="flex items-center justify-between py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-amber-600" aria-label="Alerta" />
                        {r.product} · <span className="text-muted">{r.branch}</span>
                      </span>
                      <Badge tone="amber">
                        {r.stock} / mín. {r.min_stock}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Actividad reciente" subtitle={<span className="flex items-center gap-1"><Sigma className="size-3" /> {integer(data.kpis.operations)} operaciones · éxito {pct(data.kpis.operations_success_rate)}</span>}>
              <ul className="divide-y divide-slate-100">
                {data.recent_activity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{a.module}</span> <span className="text-muted">· {a.action} · {a.user}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge tone={a.status === 'success' ? 'green' : 'red'}>{a.status === 'success' ? 'OK' : 'Error'}</Badge>
                      <span className="text-xs text-muted">{dateTime(a.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted">
            <TrendingUp className="size-3" /> <ShoppingCart className="size-3" /> Todos los indicadores se calculan en el backend con NumPy sobre datos persistidos en PostgreSQL.
          </p>
        </div>
      )}
    </>
  )
}
