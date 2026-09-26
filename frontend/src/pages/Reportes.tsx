import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Boxes, Cpu, Download, Target, TrendingUp } from 'lucide-react'
import { ModuleTabs, useTab } from '@/components/ModuleTabs'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps, ChartTooltip, INK, Legend, SERIES, TARGET_GRAY } from '@/components/charts'
import { MatrixView } from '@/components/MatrixViews'
import { Badge, Button, Card, ErrorBox, PageHeader, Select, Spinner, StatCard, Table, Td, Th } from '@/components/ui'
import { integer, lastPeriods, money, moneyShort, monthLabel, number, OPERATION_LABELS, pct } from '@/lib/utils'
import { downloadFile, errorMessage } from '@/services/api'
import { reportApi } from '@/services/endpoints'
import { toast } from 'sonner'

function ExportButton({ report, period }: { report: string; period?: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      icon={<Download className="size-3.5" />}
      onClick={async () => {
        setBusy(true)
        try {
          await downloadFile(`/reports/export/${report}.csv${period ? `?period=${period}` : ''}`, `${report}-${period ?? 'actual'}.csv`)
        } catch (e) {
          toast.error(errorMessage(e))
        } finally {
          setBusy(false)
        }
      }}
    >
      CSV
    </Button>
  )
}

function Cumplimiento({ period }: { period: string }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['compliance', period], queryFn: () => reportApi.compliance(period) })
  if (isLoading) return <Spinner />
  if (error) return <ErrorBox message={errorMessage(error)} />
  if (!data) return null
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ventas reales" value={moneyShort(data.total.actual)} hint="Σ A" />
        <StatCard label="Meta" value={moneyShort(data.total.target)} hint="Σ T" tone="accent" />
        <StatCard label="Brecha" value={moneyShort(data.total.gap)} hint="Σ (A − T)" tone={data.total.gap >= 0 ? 'green' : 'red'} />
        <StatCard label="Cumplimiento" value={pct(data.total.pct)} hint={data.formula.split(';')[1]} tone="green" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Real vs. meta por sucursal" actions={<><Legend items={[{ label: 'Real', color: SERIES[0] }, { label: 'Meta', color: TARGET_GRAY }]} /><ExportButton report="target-compliance" period={period} /></>}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.by_branch} barGap={2}>
                <CartesianGrid vertical={false} stroke={INK.grid} />
                <XAxis dataKey="branch" {...axisProps} tickFormatter={(v: string) => v.replace('Sede ', '')} />
                <YAxis {...axisProps} tickFormatter={(v: number) => moneyShort(v)} width={70} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="actual" name="Real" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="target" name="Meta" fill={TARGET_GRAY} radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Cumplimiento por producto">
          <Table>
            <thead><tr><Th>Producto</Th><Th className="text-right">Real</Th><Th className="text-right">Meta</Th><Th className="text-right">%</Th></tr></thead>
            <tbody>
              {data.by_product.map((r) => (
                <tr key={r.product}>
                  <Td className="font-medium">{r.product}</Td>
                  <Td className="num text-right">{money(r.actual)}</Td>
                  <Td className="num text-right text-muted">{money(r.target)}</Td>
                  <Td className="text-right"><Badge tone={(r.pct ?? 0) >= 100 ? 'green' : (r.pct ?? 0) >= 85 ? 'amber' : 'red'}>{pct(r.pct)}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
      <Card title="Matriz de brecha G = A − T" subtitle="Azul: por encima de la meta · Rojo: por debajo (S/)">
        <MatrixView values={data.gap_matrix.values} rowLabels={data.gap_matrix.rows} colLabels={data.gap_matrix.cols} diverging />
      </Card>
    </div>
  )
}

function Tendencia() {
  const { data, isLoading } = useQuery({ queryKey: ['trend', 12], queryFn: () => reportApi.trend(12) })
  if (isLoading) return <Spinner />
  const items = data?.items.map((i) => ({ ...i, label: monthLabel(i.period) })) ?? []
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title="Ventas mensuales (12 meses)" className="lg:col-span-2">
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={items} margin={{ top: 8, right: 16 }}>
              <CartesianGrid vertical={false} stroke={INK.grid} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v: number) => moneyShort(v)} width={70} />
              <Tooltip content={<ChartTooltip />} />
              <Line dataKey="amount" name="Ventas" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Detalle mensual">
        <Table>
          <thead><tr><Th>Mes</Th><Th className="text-right">Ventas</Th><Th className="text-right">N.º</Th></tr></thead>
          <tbody>
            {[...items].reverse().map((i) => (
              <tr key={i.period}><Td>{i.label}</Td><Td className="num text-right">{money(i.amount)}</Td><Td className="num text-right">{integer(i.sales)}</Td></tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

function Inventario() {
  const [days, setDays] = useState(30)
  const { data, isLoading } = useQuery({ queryKey: ['rotation', days], queryFn: () => reportApi.rotation(days) })
  return (
    <Card
      title="Inventario y rotación"
      subtitle={data?.formula}
      actions={
        <>
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-8 w-32 text-xs" aria-label="Ventana">
            {[30, 60, 90].map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
          </Select>
          <ExportButton report="inventory-rotation" />
        </>
      }
    >
      {isLoading && <Spinner />}
      {data && (
        <Table>
          <thead><tr><Th>Sucursal</Th><Th>Producto</Th><Th className="text-right">Stock</Th><Th className="text-right">Vendido</Th><Th className="text-right">Rotación</Th><Th className="text-right">Cobertura</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.branch + r.product}>
                <Td>{r.branch}</Td>
                <Td className="font-medium">{r.product}</Td>
                <Td className="num text-right">{integer(r.stock)}</Td>
                <Td className="num text-right">{integer(r.sold)}</Td>
                <Td className="num text-right">{r.rotation.toFixed(2)}</Td>
                <Td className="num text-right">{r.coverage_days == null ? '—' : `${number(r.coverage_days)} d`}</Td>
                <Td>{r.stock <= r.min_stock ? <Badge tone="amber"><AlertTriangle className="mr-1 size-3" />Reponer</Badge> : <Badge tone="green">OK</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}

function Procesamiento() {
  const { data, isLoading } = useQuery({ queryKey: ['ops-stats'], queryFn: reportApi.operations })
  if (isLoading || !data) return <Spinner />
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Operaciones" value={integer(data.total)} />
        <StatCard label="Exitosas" value={integer(data.success)} tone="green" />
        <StatCard label="Rechazadas" value={integer(data.errors)} tone="red" hint="Dimensiones incompatibles u otros" />
        <StatCard label="Tasa de éxito" value={pct(data.success_rate)} tone="accent" />
      </div>
      <Card title="Por tipo de operación">
        <Table>
          <thead><tr><Th>Operación</Th><Th className="text-right">Éxito</Th><Th className="text-right">Error</Th><Th className="text-right">Tiempo medio</Th></tr></thead>
          <tbody>
            {data.by_type.map((t) => (
              <tr key={t.operation_type}>
                <Td>{OPERATION_LABELS[t.operation_type]}</Td>
                <Td className="num text-right">{integer(t.success)}</Td>
                <Td className="num text-right">{integer(t.error)}</Td>
                <Td className="num text-right">{number(t.avg_ms)} ms</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

export default function Reportes() {
  const [tab, setTab] = useTab(['cumplimiento', 'tendencia', 'inventario', 'procesamiento'] as const, 'cumplimiento')
  const [period, setPeriod] = useState(lastPeriods(2)[1])
  return (
    <>
      <PageHeader
        title="Reportes"
        description="Indicadores calculados sobre datos persistidos. Exportables a CSV (compatible con Excel)."
        actions={
          tab === 'cumplimiento' && (
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40" aria-label="Periodo">
              {lastPeriods(7).map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}
            </Select>
          )
        }
      />
      <ModuleTabs value={tab} onChange={setTab} items={[
        { value: 'cumplimiento', label: 'Cumplimiento de metas', icon: <Target className="size-4" /> },
        { value: 'tendencia', label: 'Tendencia', icon: <TrendingUp className="size-4" /> },
        { value: 'inventario', label: 'Inventario y rotación', icon: <Boxes className="size-4" /> },
        { value: 'procesamiento', label: 'Procesamiento', icon: <Cpu className="size-4" /> },
      ]} />
      {tab === 'cumplimiento' && <Cumplimiento period={period} />}
      {tab === 'tendencia' && <Tendencia />}
      {tab === 'inventario' && <Inventario />}
      {tab === 'procesamiento' && <Procesamiento />}
    </>
  )
}
