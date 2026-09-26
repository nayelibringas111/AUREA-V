import { useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { useState } from 'react'
import { MatrixView, VectorView } from '@/components/MatrixViews'
import { OperationResultView } from '@/components/OperationResultView'
import { Badge, Button, Card, EmptyState, ErrorBox, Modal, PageHeader, Pagination, Select, Spinner, Table, Td, Th } from '@/components/ui'
import { dateTime, number, OPERATION_LABELS } from '@/lib/utils'
import { errorMessage } from '@/services/api'
import { operationApi } from '@/services/endpoints'

function Detail({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['operation', id], queryFn: () => operationApi.get(id) })
  return (
    <Modal open onClose={onClose} title={`Operación #${id}`} wide>
      {isLoading && <Spinner />}
      {data && (
        <div className="space-y-5">
          <div className="text-sm">
            <b>{data.description}</b> · {dateTime(data.created_at)}
            {data.scalar != null && <span className="ml-2 font-mono text-xs">k = {data.scalar}</span>}
            {data.coefficients && <span className="ml-2 font-mono text-xs">c = [{data.coefficients.join(', ')}]</span>}
          </div>
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Entradas</h4>
            <div className="space-y-3">
              {data.inputs.map((i) => (
                <div key={i.position} className="rounded-lg border border-line p-3">
                  <div className="mb-2 text-xs text-muted">
                    {i.position + 1}. {i.label ?? i.operand_kind} · {i.shape.join('×')}
                    {i.vector_id && ` · vector #${i.vector_id}`}
                    {i.matrix_id && ` · matriz #${i.matrix_id}`}
                  </div>
                  {i.operand_kind === 'vector' ? <VectorView values={i.values as number[]} /> : <MatrixView values={i.values as number[][]} compact />}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Resultado</h4>
            {data.status === 'error' ? <ErrorBox message={data.error_message ?? 'Error'} /> : <OperationResultView op={data} />}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function Historial() {
  const [filters, setFilters] = useState<{ operation_type?: string; status?: string; page: number; size: number }>({ page: 1, size: 20 })
  const [detail, setDetail] = useState<number | null>(null)
  const { data, isLoading, error } = useQuery({ queryKey: ['operations', filters], queryFn: () => operationApi.history(filters), placeholderData: (p) => p })
  return (
    <>
      <PageHeader title="Historial" description="Trazabilidad de cada operación: entradas, resultado, usuario, fecha, duración y estado." />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Select className="w-60" value={filters.operation_type ?? ''} onChange={(e) => setFilters({ ...filters, operation_type: e.target.value || undefined, page: 1 })} aria-label="Tipo">
            <option value="">Todas las operaciones</option>
            {Object.entries(OPERATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select className="w-44" value={filters.status ?? ''} onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined, page: 1 })} aria-label="Estado">
            <option value="">Todos los estados</option>
            <option value="success">Exitosas</option>
            <option value="error">Con error</option>
          </Select>
        </div>
        {isLoading && <Spinner />}
        {error && <ErrorBox message={errorMessage(error)} />}
        {data && data.items.length === 0 && <EmptyState title="Sin operaciones registradas" />}
        {data && data.items.length > 0 && (
          <>
            <Table>
              <thead><tr><Th>#</Th><Th>Fecha</Th><Th>Operación</Th><Th>Descripción</Th><Th className="text-right">Duración</Th><Th>Estado</Th><Th /></tr></thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id}>
                    <Td className="font-mono text-xs">{o.id}</Td>
                    <Td className="text-xs text-muted">{dateTime(o.created_at)}</Td>
                    <Td>{OPERATION_LABELS[o.operation_type]}</Td>
                    <Td className="max-w-md truncate text-muted" >{o.status === 'error' ? <span className="text-red-600">{o.error_message}</span> : o.description}</Td>
                    <Td className="num text-right text-xs">{number(o.duration_ms)} ms</Td>
                    <Td><Badge tone={o.status === 'success' ? 'green' : 'red'}>{o.status === 'success' ? 'Éxito' : 'Error'}</Badge></Td>
                    <Td><Button size="sm" variant="ghost" onClick={() => setDetail(o.id)} aria-label="Ver detalle"><Eye className="size-3.5" /></Button></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} size={data.size} total={data.total} onPage={(page) => setFilters({ ...filters, page })} />
          </>
        )}
      </Card>
      {detail != null && <Detail id={detail} onClose={() => setDetail(null)} />}
    </>
  )
}
