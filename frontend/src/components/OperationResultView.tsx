import { CheckCircle2, Clock, Save } from 'lucide-react'
import { MatrixView, VectorView } from '@/components/MatrixViews'
import { Badge } from '@/components/ui'
import { number, OPERATION_LABELS } from '@/lib/utils'
import type { Operation } from '@/types'

export function OperationResultView({ op }: { op: Operation }) {
  const r = op.result
  if (!r) return <p className="text-sm text-red-600">{op.error_message}</p>
  const hasNeg = Array.isArray(r.values) && (r.values as number[] | number[][]).flat().some((v) => (v as number) < 0)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone="green"><CheckCircle2 className="mr-1 size-3" /> {OPERATION_LABELS[op.operation_type]}</Badge>
        <Badge tone="slate">Resultado: {r.result_kind}{r.shape.length ? ` ${r.shape.join('×')}` : ''}</Badge>
        <Badge tone="slate"><Clock className="mr-1 size-3" /> {number(op.duration_ms)} ms</Badge>
        {(r.saved_vector_id || r.saved_matrix_id) && <Badge tone="blue"><Save className="mr-1 size-3" /> Guardado como {r.saved_vector_id ? 'vector' : 'matriz'}</Badge>}
        <span className="text-muted">Operación #{op.id}</span>
      </div>
      {r.result_kind === 'scalar' && <div className="num font-mono text-3xl font-semibold text-primary">{number(r.values as number)}</div>}
      {r.result_kind === 'vector' && <VectorView values={r.values as number[]} labels={r.labels?.rows} />}
      {r.result_kind === 'matrix' && (
        <MatrixView values={r.values as number[][]} rowLabels={r.labels?.rows} colLabels={r.labels?.cols} diverging={hasNeg} heat={!hasNeg} />
      )}
      {r.interpretation && <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">{r.interpretation}</p>}
    </div>
  )
}
