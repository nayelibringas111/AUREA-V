import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Briefcase, Play, SlidersHorizontal } from 'lucide-react'
import { ModuleTabs, useTab } from '@/components/ModuleTabs'
import { useState } from 'react'
import { toast } from 'sonner'
import { emptyOperand, OperandPicker, toOperand, type OperandState } from '@/components/OperandPicker'
import { OperationResultView } from '@/components/OperationResultView'
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select } from '@/components/ui'
import { lastPeriods, monthLabel, OPERATION_LABELS, periodRange } from '@/lib/utils'
import { errorMessage } from '@/services/api'
import { matrixApi, operationApi, productApi } from '@/services/endpoints'
import type { Operation, OperationCreate, OperationType } from '@/types'

type Kind = 'vector' | 'matrix'
const SPEC: Record<Exclude<OperationType, 'linear_combination'>, { kinds: Kind[]; scalar?: boolean; formula: string; use: string }> = {
  vector_add: { kinds: ['vector', 'vector'], formula: 'u + v', use: 'Acumulado de ventas de dos periodos.' },
  vector_subtract: { kinds: ['vector', 'vector'], formula: 'u − v', use: 'Ventas reales frente a metas.' },
  vector_scalar: { kinds: ['vector'], scalar: true, formula: 'k · u', use: 'Ajuste porcentual de precios o cantidades.' },
  dot_product: { kinds: ['vector', 'vector'], formula: 'u · v = Σ uᵢvᵢ', use: 'Cantidades × precios = ingreso total.' },
  matrix_add: { kinds: ['matrix', 'matrix'], formula: 'A + B', use: 'Ventas acumuladas por sucursal y producto.' },
  matrix_subtract: { kinds: ['matrix', 'matrix'], formula: 'A − B', use: 'Brecha real − meta por celda.' },
  matrix_scalar: { kinds: ['matrix'], scalar: true, formula: 'k · A', use: 'Proyección de crecimiento.' },
  matrix_multiply: { kinds: ['matrix', 'matrix'], formula: 'A · B', use: 'Transformar cantidades en indicadores (Q · p).' },
  matrix_transpose: { kinds: ['matrix'], formula: 'Aᵀ', use: 'Cambiar perspectiva sucursal ↔ producto.' },
}

export default function Operaciones() {
  const qc = useQueryClient()
  const [type, setType] = useState<keyof typeof SPEC>('matrix_multiply')
  const [secondKind, setSecondKind] = useState<Kind>('vector') // para A·v
  const [ops, setOps] = useState<OperandState[]>([emptyOperand(), emptyOperand()])
  const [scalar, setScalar] = useState('1.08')
  const [saveAs, setSaveAs] = useState('')
  const [result, setResult] = useState<Operation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState(lastPeriods(2)[1])
  const [tab, setTab] = useTab(['casos', 'manual'] as const, 'casos')
  const spec = SPEC[type]
  const kinds = type === 'matrix_multiply' ? (['matrix', secondKind] as Kind[]) : spec.kinds

  const run = useMutation({
    mutationFn: (body: OperationCreate) => operationApi.run(body),
    onSuccess: (op) => {
      setResult(op)
      setError(null)
      qc.invalidateQueries({ queryKey: ['operations'] })
      if (op.result?.saved_matrix_id) qc.invalidateQueries({ queryKey: ['matrices'] })
      if (op.result?.saved_vector_id) qc.invalidateQueries({ queryKey: ['vectors'] })
    },
    onError: (e) => {
      setResult(null)
      setError(errorMessage(e))
      qc.invalidateQueries({ queryKey: ['operations'] })
    },
  })

  const execute = () => {
    const operands = kinds.map((k, i) => toOperand(k, ops[i]))
    const bad = operands.find((o) => typeof o === 'string')
    if (bad) return setError(bad as string)
    run.mutate({
      operation_type: type,
      operands: operands as OperationCreate['operands'],
      scalar: spec.scalar ? Number(scalar) : undefined,
      save_result_as: saveAs.trim() || undefined,
    })
  }

  /* ---------- casos empresariales: se construyen con datos reales y se ejecutan en el backend ---------- */
  const preset = useMutation({
    mutationFn: async (key: string): Promise<OperationCreate> => {
      const range = periodRange(period)
      const label = monthLabel(period)
      if (key === 'revenue' || key === 'total') {
        const [Q, products] = await Promise.all([matrixApi.preview({ metric: 'quantity', ...range }), productApi.list()])
        const active = products.filter((p) => p.is_active).sort((a, b) => a.sku.localeCompare(b.sku))
        const p = { kind: 'vector' as const, values: active.map((x) => x.unit_price), row_labels: active.map((x) => x.name), label: 'Precios p' }
        if (key === 'revenue')
          return { operation_type: 'matrix_multiply', description: `Ingresos por sucursal a precio de lista ${label} (Q·p)`, operands: [{ kind: 'matrix', values: Q.values, row_labels: Q.row_labels, col_labels: Q.col_labels, label: `Q ${label}` }, p] }
        const units = Q.col_labels!.map((_, j) => Q.values.reduce((s, r) => s + r[j], 0))
        return { operation_type: 'dot_product', description: `Ingreso total ${label} ((Qᵀ·1)·p)`, operands: [{ kind: 'vector', values: units, row_labels: Q.col_labels, label: 'Unidades por producto' }, p] }
      }
      if (key === 'gap') {
        const [A, T] = await Promise.all([matrixApi.preview({ metric: 'amount', ...range }), matrixApi.preview({ metric: 'target_amount', period })])
        return { operation_type: 'matrix_subtract', description: `Brecha ventas − metas ${label} (A − T)`, operands: [{ kind: 'matrix', values: A.values, row_labels: A.row_labels, col_labels: A.col_labels, label: 'A' }, { kind: 'matrix', values: T.values, row_labels: T.row_labels, col_labels: T.col_labels, label: 'T' }] }
      }
      if (key === 'transpose') {
        const Q = await matrixApi.preview({ metric: 'quantity', ...range })
        return { operation_type: 'matrix_transpose', description: `Perspectiva producto × sucursal ${label} (Qᵀ)`, operands: [{ kind: 'matrix', values: Q.values, row_labels: Q.row_labels, col_labels: Q.col_labels, label: 'Q' }] }
      }
      const A = await matrixApi.preview({ metric: 'amount', ...range })
      return { operation_type: 'matrix_scalar', scalar: 1.08, description: `Proyección de ventas +8 % sobre ${label} (1.08·A)`, operands: [{ kind: 'matrix', values: A.values, row_labels: A.row_labels, col_labels: A.col_labels, label: 'A' }] }
    },
    onSuccess: (body) => run.mutate(body),
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <>
      <PageHeader title="Operaciones" description="Seleccione la operación, los operandos (guardados o manuales) y ejecútela. El cálculo se realiza en Python + NumPy y queda registrado en el historial." />
      <ModuleTabs value={tab} onChange={(t) => { setTab(t); setResult(null); setError(null) }} items={[
        { value: 'casos', label: 'Casos empresariales', icon: <Briefcase className="size-4" /> },
        { value: 'manual', label: 'Operación personalizada', icon: <SlidersHorizontal className="size-4" /> },
      ]} />
      {tab === 'casos' && (<>

      <Card
        title={<span className="flex items-center gap-2"><Briefcase className="size-4 text-accent" /> Casos empresariales</span>}
        subtitle="Construyen las matrices desde las ventas persistidas y ejecutan la operación en un clic."
        className="mb-6"
        actions={
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="h-8 w-36 text-xs" aria-label="Periodo">
            {lastPeriods(7).map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}
          </Select>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['revenue', 'Ingresos por sucursal', 'Q · p'],
            ['total', 'Ingreso total', '(Qᵀ·1) · p'],
            ['gap', 'Brecha vs. metas', 'A − T'],
            ['transpose', 'Vista por producto', 'Qᵀ'],
            ['projection', 'Proyección +8 %', '1.08 · A'],
          ].map(([key, title, f]) => (
            <button
              key={key}
              disabled={preset.isPending || run.isPending}
              onClick={() => preset.mutate(key)}
              className="rounded-lg border border-line bg-white p-3 text-left transition hover:border-primary hover:shadow-sm disabled:opacity-50"
            >
              <div className="text-sm font-medium">{title}</div>
              <div className="mt-1 font-mono text-xs text-primary">{f}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Resultado" subtitle={result?.description ?? undefined}>
        {error && <ErrorBox message={`Operación rechazada: ${error}`} />}
        {preset.isPending && <p className="text-sm text-muted">Construyendo matrices desde la base de datos…</p>}
        {!error && !result && !preset.isPending && <p className="text-sm text-muted">Elija un caso empresarial para ver el resultado.</p>}
        {result && <OperationResultView op={result} />}
      </Card>
      </>)}
      {tab === 'manual' && (
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Configurar operación" className="lg:col-span-2">
          <div className="space-y-4">
            <Field label="Operación">
              <Select value={type} onChange={(e) => { setType(e.target.value as keyof typeof SPEC); setOps([emptyOperand(), emptyOperand()]); setResult(null); setError(null) }}>
                {Object.keys(SPEC).map((k) => <option key={k} value={k}>{OPERATION_LABELS[k]}</option>)}
              </Select>
            </Field>
            <div className="rounded-lg bg-slate-900 px-4 py-3 text-sm text-white">
              <span className="font-mono text-accent">{type === 'matrix_multiply' && secondKind === 'vector' ? 'A · v' : spec.formula}</span>
              <p className="mt-1 text-xs text-slate-400">{spec.use}</p>
            </div>
            {type === 'matrix_multiply' && (
              <Field label="Segundo operando">
                <Select value={secondKind} onChange={(e) => { setSecondKind(e.target.value as Kind); setOps([ops[0], emptyOperand()]) }}>
                  <option value="vector">Vector (A · v)</option>
                  <option value="matrix">Matriz (A · B)</option>
                </Select>
              </Field>
            )}
            {kinds.map((k, i) => (
              <OperandPicker key={`${type}-${i}-${k}`} kind={k} label={kinds.length === 1 ? 'Operando' : `Operando ${i === 0 ? (k === 'matrix' ? 'A' : 'u') : k === 'matrix' ? 'B' : 'v'}`} value={ops[i]} onChange={(s) => setOps(ops.map((o, j) => (j === i ? s : o)))} />
            ))}
            {spec.scalar && (
              <Field label="Escalar k" hint="1.10 = +10 %, 0.95 = −5 %">
                <Input type="number" step="0.01" value={scalar} onChange={(e) => setScalar(e.target.value)} />
              </Field>
            )}
            <Field label="Guardar resultado como (opcional)" hint="Crea un nuevo vector o matriz con el resultado.">
              <Input value={saveAs} onChange={(e) => setSaveAs(e.target.value)} placeholder="Ej. Ingresos Q3" />
            </Field>
            <Button className="w-full" icon={<Play className="size-4" />} loading={run.isPending} onClick={execute}>
              Ejecutar
            </Button>
          </div>
        </Card>
        <Card title="Resultado" className="lg:col-span-3" subtitle={result?.description ?? undefined}>
          {error && <ErrorBox message={`Operación rechazada: ${error}`} />}
          {preset.isPending && <p className="text-sm text-muted">Construyendo matrices desde la base de datos…</p>}
          {!error && !result && <p className="text-sm text-muted">Configure y ejecute una operación para ver el resultado.</p>}
          {result && <OperationResultView op={result} />}
          {error && <p className="mt-3 text-xs text-muted">La operación rechazada también queda registrada en el historial con estado “error”.</p>}
        </Card>
      </div>
      )}
    </>
  )
}
