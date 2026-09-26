import { useQuery } from '@tanstack/react-query'
import { MatrixView, VectorView } from '@/components/MatrixViews'
import { Select, Tabs, Textarea } from '@/components/ui'
import { parseNumberList } from '@/lib/utils'
import { matrixApi, vectorApi } from '@/services/endpoints'
import type { OperandIn } from '@/types'

export interface OperandState {
  mode: 'saved' | 'manual'
  id?: number
  text: string
}

export const emptyOperand = (): OperandState => ({ mode: 'saved', text: '' })

/** Convierte el estado del selector en el operando que espera la API (o un mensaje de error). */
export function toOperand(kind: 'vector' | 'matrix', s: OperandState): OperandIn | string {
  if (s.mode === 'saved') return s.id ? { kind, id: s.id } : `Seleccione un ${kind === 'vector' ? 'vector' : 'matriz'} guardado`
  if (!s.text.trim()) return 'Ingrese los valores del operando'
  if (kind === 'vector') {
    const v = parseNumberList(s.text)
    return v.some(Number.isNaN) ? 'El vector contiene valores no numéricos' : { kind, values: v }
  }
  const rows = s.text
    .trim()
    .split(/\n+/)
    .map((line) => parseNumberList(line))
  if (rows.flat().some(Number.isNaN)) return 'La matriz contiene valores no numéricos'
  return { kind, values: rows }
}

export function OperandPicker({ kind, value, onChange, label }: { kind: 'vector' | 'matrix'; value: OperandState; onChange: (s: OperandState) => void; label: string }) {
  const vectors = useQuery({ queryKey: ['vectors'], queryFn: vectorApi.list, enabled: kind === 'vector' })
  const matrices = useQuery({ queryKey: ['matrices'], queryFn: matrixApi.list, enabled: kind === 'matrix' })
  const selV = vectors.data?.find((v) => v.id === value.id)
  const selM = matrices.data?.find((m) => m.id === value.id)

  return (
    <div className="rounded-lg border border-line bg-slate-50/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {label} <span className="font-normal text-muted">({kind === 'vector' ? 'vector' : 'matriz'})</span>
        </span>
        <Tabs value={value.mode} onChange={(mode) => onChange({ ...value, mode })} items={[{ value: 'saved', label: 'Guardado' }, { value: 'manual', label: 'Manual' }]} />
      </div>
      {value.mode === 'saved' ? (
        <>
          <Select value={value.id ?? ''} onChange={(e) => onChange({ ...value, id: e.target.value ? Number(e.target.value) : undefined })} aria-label={label}>
            <option value="">Seleccione…</option>
            {kind === 'vector'
              ? vectors.data?.map((v) => <option key={v.id} value={v.id}>{v.name} · dim {v.dimension}</option>)
              : matrices.data?.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.rows}×{m.cols}</option>)}
          </Select>
          <div className="mt-3">
            {selV && <VectorView values={selV.values} labels={selV.labels} />}
            {selM && <MatrixView values={selM.values} rowLabels={selM.row_labels} colLabels={selM.col_labels} compact />}
          </div>
        </>
      ) : (
        <Textarea
          rows={kind === 'vector' ? 2 : 4}
          className="font-mono text-xs"
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder={kind === 'vector' ? '3200, 2800, 750, 120, 60' : '12 8 20\n5 3 9\n(una fila por línea)'}
          aria-label={`${label} manual`}
        />
      )}
    </div>
  )
}
