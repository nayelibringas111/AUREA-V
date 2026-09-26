import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps, ChartTooltip, INK, SERIES } from '@/components/charts'
import { emptyOperand, OperandPicker, toOperand, type OperandState } from '@/components/OperandPicker'
import { OperationResultView } from '@/components/OperationResultView'
import { Button, Card, ErrorBox, Input, PageHeader, Select, Spinner, Table, Tabs, Td, Th } from '@/components/ui'
import { lastPeriods, money, monthLabel, number, pct } from '@/lib/utils'
import { errorMessage } from '@/services/api'
import { operationApi, reportApi } from '@/services/endpoints'
import type { Operation, OperationCreate } from '@/types'

const WEIGHT_LABELS = { w_sales: 'Ventas', w_margin: 'Margen', w_compliance: 'Cumplimiento', w_rotation: 'Rotación' } as const
type WKey = keyof typeof WEIGHT_LABELS

function PerformanceIndex() {
  const [period, setPeriod] = useState(lastPeriods(2)[1])
  const [raw, setRaw] = useState<Record<WKey, number>>({ w_sales: 40, w_margin: 30, w_compliance: 20, w_rotation: 10 })
  const sum = Object.values(raw).reduce((a, b) => a + b, 0) || 1
  const weights = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.round((v / sum) * 1000) / 1000])) as Record<WKey, number>
  // Ajuste por redondeo para que sumen exactamente 1
  weights.w_rotation = Math.round((1 - weights.w_sales - weights.w_margin - weights.w_compliance) * 1000) / 1000
  const { data, isLoading, error } = useQuery({ queryKey: ['performance', period, weights], queryFn: () => reportApi.performance(period, weights), placeholderData: (p) => p })
  const sorted = data ? [...data.items].sort((a, b) => a.rank - b.rank) : []

  return (
    <Card
      title="Índice de desempeño por sucursal"
      subtitle="índice = w₁·ventas + w₂·margen + w₃·cumplimiento + w₄·rotación (componentes normalizados 0–100)"
      actions={
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="h-8 w-36 text-xs" aria-label="Periodo">
          {lastPeriods(7).map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}
        </Select>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          {(Object.keys(WEIGHT_LABELS) as WKey[]).map((k) => (
            <label key={k} className="block">
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium">{WEIGHT_LABELS[k]}</span>
                <span className="num font-mono text-primary">w = {weights[k].toFixed(2)}</span>
              </div>
              <input type="range" min={0} max={100} value={raw[k]} onChange={(e) => setRaw({ ...raw, [k]: Number(e.target.value) })} className="w-full accent-primary" />
            </label>
          ))}
          <p className="text-xs text-muted">Los pesos se normalizan automáticamente para que Σwᵢ = 1.</p>
        </div>
        <div className="lg:col-span-2">
          {isLoading && <Spinner />}
          {error && <ErrorBox message={errorMessage(error)} />}
          {data && (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={sorted} layout="vertical" margin={{ left: 16, right: 40 }}>
                  <CartesianGrid horizontal={false} stroke={INK.grid} />
                  <XAxis type="number" domain={[0, 100]} {...axisProps} />
                  <YAxis type="category" dataKey="branch" {...axisProps} width={100} />
                  <Tooltip content={<ChartTooltip format={(v) => number(v)} />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="index" name="Índice" fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={26}>
                    <LabelList dataKey="index" position="right" formatter={(v: number) => number(v)} style={{ fill: INK.primary, fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      {data && (
        <Table className="mt-4">
          <thead>
            <tr><Th>#</Th><Th>Sucursal</Th><Th className="text-right">Ventas</Th><Th className="text-right">Margen</Th><Th className="text-right">Cumplimiento</Th><Th className="text-right">Rotación</Th><Th className="text-right">Índice</Th></tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.branch}>
                <Td className="font-semibold">{r.rank}</Td>
                <Td className="font-medium">{r.branch}</Td>
                <Td className="num text-right">{money(r.sales)}</Td>
                <Td className="num text-right">{money(r.margin)}</Td>
                <Td className="num text-right">{pct(r.compliance_pct)}</Td>
                <Td className="num text-right">{r.rotation.toFixed(2)}</Td>
                <Td className="num text-right font-semibold text-primary">{number(r.index)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}

function GenericCombination() {
  const qc = useQueryClient()
  const [kind, setKind] = useState<'vector' | 'matrix'>('vector')
  const [items, setItems] = useState<{ op: OperandState; c: string }[]>([
    { op: emptyOperand(), c: '0.5' },
    { op: emptyOperand(), c: '0.5' },
  ])
  const [result, setResult] = useState<Operation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = useMutation({
    mutationFn: (b: OperationCreate) => operationApi.run(b),
    onSuccess: (op) => { setResult(op); setError(null); qc.invalidateQueries({ queryKey: ['operations'] }) },
    onError: (e) => { setResult(null); setError(errorMessage(e)) },
  })
  const execute = () => {
    const ops = items.map((i) => toOperand(kind, i.op))
    const bad = ops.find((o) => typeof o === 'string')
    if (bad) return setError(bad as string)
    const coefs = items.map((i) => Number(i.c))
    if (coefs.some(Number.isNaN)) return setError('Los coeficientes deben ser numéricos')
    run.mutate({ operation_type: 'linear_combination', operands: ops as OperationCreate['operands'], coefficients: coefs })
  }
  const formula = items.map((it, i) => `${it.c || '?'}·${kind === 'vector' ? 'v' : 'M'}${i + 1}`).join(' + ')

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card title="Combinación lineal" subtitle="Σ cᵢ · Xᵢ con vectores o matrices de igual dimensión" className="lg:col-span-2">
        <div className="space-y-4">
          <Tabs value={kind} onChange={(k) => { setKind(k); setItems(items.map((i) => ({ ...i, op: emptyOperand() }))) }} items={[{ value: 'vector', label: 'Vectores' }, { value: 'matrix', label: 'Matrices' }]} />
          <div className="rounded-lg bg-slate-900 px-4 py-3 font-mono text-sm text-accent">{formula}</div>
          {items.map((it, i) => (
            <div key={`${kind}-${i}`} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">c{i + 1} =</span>
                <Input className="h-8 w-24" type="number" step="0.1" value={it.c} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, c: e.target.value } : x)))} aria-label={`Coeficiente ${i + 1}`} />
                <Button size="sm" variant="ghost" disabled={items.length <= 1} onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Quitar"><Trash2 className="size-3.5" /></Button>
              </div>
              <OperandPicker kind={kind} label={`${kind === 'vector' ? 'v' : 'M'}${i + 1}`} value={it.op} onChange={(s) => setItems(items.map((x, j) => (j === i ? { ...x, op: s } : x)))} />
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Plus className="size-4" />} disabled={items.length >= 6} onClick={() => setItems([...items, { op: emptyOperand(), c: '1' }])}>Término</Button>
            <Button className="flex-1" icon={<Play className="size-4" />} loading={run.isPending} onClick={execute}>Calcular</Button>
          </div>
        </div>
      </Card>
      <Card title="Resultado" className="lg:col-span-3">
        {error && <ErrorBox message={error} />}
        {!error && !result && <p className="text-sm text-muted">Ejemplo: 0.6·(ventas mes 1) + 0.4·(ventas mes 2) = ventas ponderadas.</p>}
        {result && <OperationResultView op={result} />}
      </Card>
    </div>
  )
}

export default function Combinaciones() {
  return (
    <>
      <PageHeader title="Combinaciones lineales" description="Indicadores ponderados: el índice de desempeño empresarial y combinaciones libres de vectores o matrices." />
      <div className="space-y-6">
        <PerformanceIndex />
        <GenericCombination />
      </div>
    </>
  )
}
