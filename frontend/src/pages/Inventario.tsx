import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownUp, Boxes, Grid3x3 } from 'lucide-react'
import { ModuleTabs, useTab } from '@/components/ModuleTabs'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { MatrixView } from '@/components/MatrixViews'
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td, Th } from '@/components/ui'
import { dateTime, integer } from '@/lib/utils'
import { movementSchema, type MovementForm } from '@/schemas'
import { errorMessage } from '@/services/api'
import { branchApi, inventoryApi, matrixApi, productApi } from '@/services/endpoints'

function MovementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const branches = useQuery({ queryKey: ['branches'], queryFn: branchApi.list })
  const products = useQuery({ queryKey: ['products'], queryFn: productApi.list })
  const form = useForm<MovementForm>({ resolver: zodResolver(movementSchema), defaultValues: { movement_type: 'entrada', quantity: 1, branch_id: '', product_id: '' } as unknown as MovementForm })
  const type = form.watch('movement_type')
  const save = useMutation({
    mutationFn: (d: MovementForm) => inventoryApi.move(movementSchema.parse(d)),
    onSuccess: () => {
      toast.success('Movimiento registrado')
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      form.reset()
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const e = form.formState.errors
  return (
    <Modal open={open} onClose={onClose} title="Registrar movimiento de inventario">
      <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="grid grid-cols-2 gap-4">
        <Field label="Sucursal" error={e.branch_id?.message}>
          <Select {...form.register('branch_id')}>
            <option value="">Seleccione…</option>
            {branches.data?.filter((b) => b.is_active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Producto" error={e.product_id?.message}>
          <Select {...form.register('product_id')}>
            <option value="">Seleccione…</option>
            {products.data?.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Tipo">
          <Select {...form.register('movement_type')}>
            <option value="entrada">Entrada (compra / reposición)</option>
            <option value="salida">Salida (merma / traslado)</option>
            <option value="ajuste">Ajuste (conteo físico)</option>
          </Select>
        </Field>
        <Field label={type === 'ajuste' ? 'Stock final contado' : 'Cantidad'} error={e.quantity?.message}>
          <Input type="number" min={0} {...form.register('quantity')} />
        </Field>
        <Field label="Motivo" className="col-span-2"><Input {...form.register('reason')} placeholder="Ej. Reposición proveedor" /></Field>
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={save.isPending}>Registrar</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Inventario() {
  const [tab, setTab] = useTab(['stock', 'matriz', 'movimientos'] as const, 'stock')
  const [branchId, setBranchId] = useState<number | undefined>()
  const [onlyLow, setOnlyLow] = useState(false)
  const [open, setOpen] = useState(false)
  const branches = useQuery({ queryKey: ['branches'], queryFn: branchApi.list })
  const inv = useQuery({ queryKey: ['inventory', branchId, onlyLow], queryFn: () => inventoryApi.list({ branch_id: branchId, low_stock: onlyLow }) })
  const movs = useQuery({ queryKey: ['movements', branchId], queryFn: () => inventoryApi.movements({ branch_id: branchId, limit: 100 }), enabled: tab === 'movimientos' })
  const stockMatrix = useQuery({ queryKey: ['matrix-preview', 'stock'], queryFn: () => matrixApi.preview({ metric: 'stock' }), enabled: tab === 'matriz' })

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Existencias por sucursal y producto (matriz S) y trazabilidad de movimientos."
        actions={<Button icon={<ArrowDownUp className="size-4" />} onClick={() => setOpen(true)}>Nuevo movimiento</Button>}
      />
      <ModuleTabs value={tab} onChange={setTab} items={[
        { value: 'stock', label: 'Existencias', icon: <Boxes className="size-4" /> },
        { value: 'matriz', label: 'Matriz S', icon: <Grid3x3 className="size-4" /> },
        { value: 'movimientos', label: 'Movimientos', icon: <ArrowDownUp className="size-4" /> },
      ]} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select className="w-52" value={branchId ?? ''} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : undefined)} aria-label="Sucursal">
          <option value="">Todas las sucursales</option>
          {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        {tab === 'stock' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="size-4 accent-primary" /> Solo stock bajo
          </label>
        )}
      </div>
      <Card>
        {tab === 'stock' && (
          <>
            {inv.isLoading && <Spinner />}
            {inv.error && <ErrorBox message={errorMessage(inv.error)} />}
            {inv.data && (
              <Table>
                <thead><tr><Th>Sucursal</Th><Th>Producto</Th><Th className="text-right">Stock</Th><Th className="text-right">Mínimo</Th><Th>Estado</Th></tr></thead>
                <tbody>
                  {inv.data.map((i) => {
                    const low = i.stock <= i.min_stock
                    return (
                      <tr key={i.id}>
                        <Td>{i.branch.name}</Td>
                        <Td className="font-medium">{i.product.name}</Td>
                        <Td className="num text-right font-medium">{integer(i.stock)}</Td>
                        <Td className="num text-right text-muted">{integer(i.min_stock)}</Td>
                        <Td>
                          {low ? (
                            <Badge tone="amber"><AlertTriangle className="mr-1 size-3" /> Stock bajo</Badge>
                          ) : (
                            <Badge tone="green">Normal</Badge>
                          )}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
          </>
        )}
        {tab === 'matriz' && (
          <>
            {stockMatrix.isLoading && <Spinner />}
            {stockMatrix.data && (
              <>
                <p className="mb-3 text-xs text-muted">{stockMatrix.data.description} Dimensión {stockMatrix.data.rows}×{stockMatrix.data.cols}.</p>
                <MatrixView values={stockMatrix.data.values} rowLabels={stockMatrix.data.row_labels} colLabels={stockMatrix.data.col_labels} heat />
              </>
            )}
          </>
        )}
        {tab === 'movimientos' && (
          <>
            {movs.isLoading && <Spinner />}
            {movs.data && (
              <Table>
                <thead><tr><Th>Fecha</Th><Th>Sucursal</Th><Th>Producto</Th><Th>Tipo</Th><Th className="text-right">Cantidad</Th><Th>Motivo</Th></tr></thead>
                <tbody>
                  {movs.data.map((m) => (
                    <tr key={m.id}>
                      <Td className="text-xs text-muted">{dateTime(m.created_at)}</Td>
                      <Td>{m.branch.name}</Td>
                      <Td>{m.product.name}</Td>
                      <Td><Badge tone={m.movement_type === 'entrada' ? 'green' : m.movement_type === 'salida' ? 'red' : 'blue'}>{m.movement_type}</Badge></Td>
                      <Td className="num text-right">{m.movement_type === 'salida' ? '−' : m.quantity > 0 && m.movement_type === 'ajuste' ? '+' : ''}{integer(m.quantity)}</Td>
                      <Td className="text-muted">{m.reason}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        )}
      </Card>
      <MovementModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
