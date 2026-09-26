import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, Card, ErrorBox, PageHeader, Pagination, Select, Spinner, Table, Td, Th } from '@/components/ui'
import { dateTime } from '@/lib/utils'
import { errorMessage } from '@/services/api'
import { auditApi } from '@/services/endpoints'

const MODULES = ['auth', 'usuarios', 'empresa', 'sucursales', 'productos', 'ventas', 'inventario', 'metas', 'vectores', 'matrices', 'operaciones', 'sistema']

export default function Auditoria() {
  const [f, setF] = useState<{ module?: string; status?: string; page: number; size: number }>({ page: 1, size: 30 })
  const { data, isLoading, error } = useQuery({ queryKey: ['audit', f], queryFn: () => auditApi.list(f), placeholderData: (p) => p })
  return (
    <>
      <PageHeader title="Auditoría" description="Registro de usuario, acción, módulo, fecha, IP, estado y resultado de cada evento del sistema." />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Select className="w-48" value={f.module ?? ''} onChange={(e) => setF({ ...f, module: e.target.value || undefined, page: 1 })} aria-label="Módulo">
            <option value="">Todos los módulos</option>
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Select className="w-40" value={f.status ?? ''} onChange={(e) => setF({ ...f, status: e.target.value || undefined, page: 1 })} aria-label="Estado">
            <option value="">Todos</option>
            <option value="success">Éxito</option>
            <option value="error">Error</option>
          </Select>
        </div>
        {isLoading && <Spinner />}
        {error && <ErrorBox message={errorMessage(error)} />}
        {data && (
          <>
            <Table>
              <thead><tr><Th>Fecha</Th><Th>Usuario</Th><Th>Módulo</Th><Th>Acción</Th><Th>Entidad</Th><Th>IP</Th><Th>Estado</Th><Th>Detalle</Th></tr></thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id}>
                    <Td className="text-xs text-muted">{dateTime(l.created_at)}</Td>
                    <Td className="text-xs">{l.user_email ?? '—'}</Td>
                    <Td><Badge>{l.module}</Badge></Td>
                    <Td>{l.action}</Td>
                    <Td className="font-mono text-xs">{l.entity_id ?? ''}</Td>
                    <Td className="font-mono text-xs text-muted">{l.ip_address ?? ''}</Td>
                    <Td><Badge tone={l.status === 'success' ? 'green' : 'red'}>{l.status}</Badge></Td>
                    <Td className="max-w-xs truncate font-mono text-[11px] text-muted" >{l.detail ? JSON.stringify(l.detail) : ''}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} size={data.size} total={data.total} onPage={(page) => setF({ ...f, page })} />
          </>
        )}
      </Card>
    </>
  )
}
