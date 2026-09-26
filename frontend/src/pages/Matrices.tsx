import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { MatrixEditor, MatrixView, toNumberGrid } from '@/components/MatrixViews'
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner } from '@/components/ui'
import { currentPeriod, dateTime, lastPeriods, monthLabel, periodRange } from '@/lib/utils'
import { errorMessage } from '@/services/api'
import { matrixApi, type MatrixFromSales, type MatrixMetric } from '@/services/endpoints'
import type { Matrix } from '@/types'

function MatrixModal({ matrix, open, onClose }: { matrix: Matrix | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(matrix?.name ?? '')
  const [description, setDescription] = useState(matrix?.description ?? '')
  const [values, setValues] = useState<(number | string)[][]>(matrix?.values ?? [[0, 0], [0, 0]])
  const [rowLabels, setRowLabels] = useState<string[]>(matrix?.row_labels ?? values.map(() => ''))
  const [colLabels, setColLabels] = useState<string[]>(matrix?.col_labels ?? values[0].map(() => ''))
  const grid = toNumberGrid(values)
  const clean = (l: string[], p: string) => (l.some((x) => x.trim()) ? l.map((x, i) => x.trim() || `${p}${i + 1}`) : null)
  const save = useMutation({
    mutationFn: () => {
      const body = { name, description, values: grid!, row_labels: clean(rowLabels, 'f'), col_labels: clean(colLabels, 'c') }
      return matrix ? matrixApi.update(matrix.id, body) : matrixApi.create(body)
    },
    onSuccess: () => {
      toast.success('Matriz guardada')
      qc.invalidateQueries({ queryKey: ['matrices'] })
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Modal open={open} onClose={onClose} title={matrix ? 'Editar matriz' : 'Nueva matriz'} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Descripción"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs text-muted">Cuadrícula editable. Las etiquetas de fila y columna son opcionales.</p>
        <MatrixEditor values={values} onChange={setValues} rowLabels={rowLabels} colLabels={colLabels} onRowLabels={setRowLabels} onColLabels={setColLabels} maxRows={20} maxCols={20} />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-xs text-red-600">{!grid ? 'Hay celdas vacías o no numéricas.' : ''}</span>
        <Button disabled={!grid || !name.trim()} loading={save.isPending} onClick={() => save.mutate()}>Guardar matriz</Button>
      </div>
    </Modal>
  )
}

const METRICS: { value: MatrixMetric; label: string }[] = [
  { value: 'quantity', label: 'Q · Unidades vendidas' },
  { value: 'amount', label: 'A · Ventas en importe (S/)' },
  { value: 'target_quantity', label: 'T · Metas en unidades' },
  { value: 'target_amount', label: 'T · Metas en importe (S/)' },
  { value: 'stock', label: 'S · Existencias actuales' },
]

function FromDataModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [metric, setMetric] = useState<MatrixMetric>('quantity')
  const [period, setPeriod] = useState(currentPeriod())
  const [name, setName] = useState('')
  const [preview, setPreview] = useState<Matrix | null>(null)
  const body = (): MatrixFromSales => {
    if (metric === 'stock') return { metric, name: name || undefined }
    if (metric.startsWith('target')) return { metric, period, name: name || undefined }
    return { metric, ...periodRange(period), name: name || `${METRICS.find((m) => m.value === metric)!.label.split(' · ')[1]} ${period}` }
  }
  const prev = useMutation({ mutationFn: () => matrixApi.preview(body()), onSuccess: setPreview, onError: (e) => toast.error(errorMessage(e)) })
  const save = useMutation({
    mutationFn: () => matrixApi.fromSales(body()),
    onSuccess: (m) => {
      toast.success(`Matriz "${m.name}" generada (${m.rows}×${m.cols})`)
      qc.invalidateQueries({ queryKey: ['matrices'] })
      setPreview(null)
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Modal open={open} onClose={onClose} title="Generar matriz desde datos del negocio" wide>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Métrica">
          <Select value={metric} onChange={(e) => { setMetric(e.target.value as MatrixMetric); setPreview(null) }}>
            {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </Field>
        <Field label="Periodo" hint={metric === 'stock' ? 'No aplica a existencias' : undefined}>
          <Select value={period} disabled={metric === 'stock'} onChange={(e) => { setPeriod(e.target.value); setPreview(null) }}>
            {lastPeriods(8).map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}
          </Select>
        </Field>
        <Field label="Nombre (opcional)"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" icon={<Eye className="size-4" />} loading={prev.isPending} onClick={() => prev.mutate()}>Previsualizar</Button>
        <Button icon={<Database className="size-4" />} loading={save.isPending} onClick={() => save.mutate()}>Generar y guardar</Button>
      </div>
      {preview && (
        <div className="mt-5">
          <p className="mb-2 text-xs text-muted">{preview.description} Dimensión {preview.rows}×{preview.cols} (sucursales × productos).</p>
          <MatrixView values={preview.values} rowLabels={preview.row_labels} colLabels={preview.col_labels} heat />
        </div>
      )}
    </Modal>
  )
}

export default function Matrices() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['matrices'], queryFn: matrixApi.list })
  const [editing, setEditing] = useState<Matrix | null>(null)
  const [open, setOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  const [key, setKey] = useState(0)
  const remove = useMutation({
    mutationFn: matrixApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matrices'] }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const openModal = (m: Matrix | null) => {
    setEditing(m)
    setKey((k) => k + 1)
    setOpen(true)
  }
  return (
    <>
      <PageHeader
        title="Matrices"
        description="Información multidimensional. Las matrices del negocio tienen sucursales en filas y productos en columnas."
        actions={
          <>
            <Button variant="accent" icon={<Database className="size-4" />} onClick={() => setDataOpen(true)}>Desde datos del negocio</Button>
            <Button icon={<Plus className="size-4" />} onClick={() => openModal(null)}>Nueva matriz</Button>
          </>
        }
      />
      {isLoading && <Spinner />}
      {error && <ErrorBox message={errorMessage(error)} />}
      {data && data.length === 0 && <EmptyState title="Aún no hay matrices" />}
      <div className="grid gap-4 xl:grid-cols-2">
        {data?.map((m) => (
          <Card
            key={m.id}
            title={m.name}
            subtitle={`${m.rows}×${m.cols} · ${dateTime(m.created_at)}`}
            actions={
              <>
                <Badge tone="cyan">{m.source}</Badge>
                <Button size="sm" variant="ghost" onClick={() => openModal(m)} aria-label="Editar"><Pencil className="size-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => confirm(`¿Eliminar "${m.name}"?`) && remove.mutate(m.id)} aria-label="Eliminar"><Trash2 className="size-3.5" /></Button>
              </>
            }
          >
            <MatrixView values={m.values} rowLabels={m.row_labels} colLabels={m.col_labels} compact />
            {m.description && <p className="mt-2 text-xs text-muted">{m.description}</p>}
          </Card>
        ))}
      </div>
      <MatrixModal key={key} matrix={editing} open={open} onClose={() => setOpen(false)} />
      <FromDataModal open={dataOpen} onClose={() => setDataOpen(false)} />
    </>
  )
}
