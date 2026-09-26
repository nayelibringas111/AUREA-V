import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, Table, Td, Th } from '@/components/ui'
import { dateOnly, integer, money, today } from '@/lib/utils'
import { errorMessage } from '@/services/api'
import { branchApi, inventoryApi, productApi, salesApi, type SaleFilters } from '@/services/endpoints'

interface Line {
  product_id: number | ''
  quantity: number | ''
}

function NewSaleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const branches = useQuery({ queryKey: ['branches'], queryFn: branchApi.list })
  const products = useQuery({ queryKey: ['products'], queryFn: productApi.list })
  const [branchId, setBranchId] = useState<number | ''>('')
  const [date, setDate] = useState(today())
  const [customer, setCustomer] = useState('')
  const [lines, setLines] = useState<Line[]>([{ product_id: '', quantity: 1 }])
  const inventory = useQuery({
    queryKey: ['inventory', branchId],
    queryFn: () => inventoryApi.list({ branch_id: Number(branchId) }),
    enabled: !!branchId,
  })
  const stockOf = (pid: number) => inventory.data?.find((i) => i.product_id === pid)?.stock ?? 0
  const activeProducts = products.data?.filter((p) => p.is_active) ?? []
  const priceOf = (pid: number) => activeProducts.find((p) => p.id === pid)?.unit_price ?? 0
  const total = lines.reduce((s, l) => s + (l.product_id && l.quantity ? priceOf(Number(l.product_id)) * Number(l.quantity) : 0), 0)

  const problems = useMemo(() => {
    const p: string[] = []
    if (!branchId) p.push('Seleccione una sucursal')
    lines.forEach((l, i) => {
      if (!l.product_id) p.push(`Línea ${i + 1}: seleccione producto`)
      else if (!l.quantity || Number(l.quantity) <= 0) p.push(`Línea ${i + 1}: cantidad inválida`)
      else if (inventory.data && Number(l.quantity) > stockOf(Number(l.product_id))) p.push(`Línea ${i + 1}: supera el stock (${stockOf(Number(l.product_id))})`)
    })
    return p
  }, [branchId, lines, inventory.data])

  const save = useMutation({
    mutationFn: () =>
      salesApi.create({
        branch_id: Number(branchId),
        sale_date: date,
        customer: customer || undefined,
        details: lines.map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity) })),
      }),
    onSuccess: (s) => {
      toast.success(`Venta #${s.id} registrada por ${money(s.total)}`)
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setLines([{ product_id: '', quantity: 1 }])
      setCustomer('')
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const update = (i: number, patch: Partial<Line>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)))

  return (
    <Modal open={open} onClose={onClose} title="Registrar venta" wide>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Sucursal">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Seleccione…</option>
            {branches.data?.filter((b) => b.is_active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Fecha"><Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Cliente"><Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Opcional" /></Field>
      </div>
      <div className="mt-5 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 items-end gap-2">
            <Field label={i === 0 ? 'Producto' : ''} className="col-span-6">
              <Select value={l.product_id} onChange={(e) => update(i, { product_id: e.target.value ? Number(e.target.value) : '' })}>
                <option value="">Seleccione…</option>
                {activeProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {money(p.unit_price)} {branchId && inventory.data ? `(stock ${stockOf(p.id)})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={i === 0 ? 'Cantidad' : ''} className="col-span-2">
              <Input type="number" min={1} value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value ? Number(e.target.value) : '' })} />
            </Field>
            <div className="num col-span-3 pb-2.5 text-right text-sm">
              {l.product_id && l.quantity ? money(priceOf(Number(l.product_id)) * Number(l.quantity)) : '—'}
            </div>
            <div className="col-span-1 pb-1 text-right">
              <Button size="sm" variant="ghost" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, k) => k !== i))} aria-label="Quitar línea">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
        <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => setLines([...lines, { product_id: '', quantity: 1 }])}>
          Agregar producto
        </Button>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="text-xs text-red-600">{problems[0] ?? ''}</div>
        <div className="flex items-center gap-4">
          <span className="text-sm">Total: <b className="num">{money(total)}</b></span>
          <Button disabled={problems.length > 0} loading={save.isPending} onClick={() => save.mutate()}>Registrar venta</Button>
        </div>
      </div>
    </Modal>
  )
}

export default function Ventas() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState<SaleFilters>({ page: 1, size: 15 })
  const [expanded, setExpanded] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const branches = useQuery({ queryKey: ['branches'], queryFn: branchApi.list })
  const { data, isLoading, error } = useQuery({ queryKey: ['sales', filters], queryFn: () => salesApi.list(filters), placeholderData: (p) => p })
  const cancel = useMutation({
    mutationFn: salesApi.cancel,
    onSuccess: () => {
      toast.success('Venta anulada y stock restituido')
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const set = (patch: Partial<SaleFilters>) => setFilters({ ...filters, ...patch, page: 1 })

  return (
    <>
      <PageHeader
        title="Ventas"
        description="Registro y consulta de ventas. Cada venta descuenta inventario y alimenta las matrices Q (unidades) y A (importes)."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Nueva venta</Button>}
      />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={filters.branch_id ?? ''} onChange={(e) => set({ branch_id: e.target.value ? Number(e.target.value) : undefined })} aria-label="Sucursal">
            <option value="">Todas las sucursales</option>
            {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Input type="date" value={filters.date_from ?? ''} onChange={(e) => set({ date_from: e.target.value || undefined })} aria-label="Desde" />
          <Input type="date" value={filters.date_to ?? ''} onChange={(e) => set({ date_to: e.target.value || undefined })} aria-label="Hasta" />
          <Select value={filters.status ?? ''} onChange={(e) => set({ status: e.target.value || undefined })} aria-label="Estado">
            <option value="">Todos los estados</option>
            <option value="registrada">Registradas</option>
            <option value="anulada">Anuladas</option>
          </Select>
        </div>
        {isLoading && <Spinner />}
        {error && <ErrorBox message={errorMessage(error)} />}
        {data && data.items.length === 0 && <EmptyState title="No hay ventas con estos filtros" />}
        {data && data.items.length > 0 && (
          <>
            <Table>
              <thead>
                <tr><Th /><Th>N.º</Th><Th>Fecha</Th><Th>Sucursal</Th><Th>Cliente</Th><Th className="text-right">Ítems</Th><Th className="text-right">Total</Th><Th>Estado</Th><Th /></tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <Fragment key={s.id}>
                    <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                      <Td className="w-6">{expanded === s.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</Td>
                      <Td className="font-mono text-xs">#{s.id}</Td>
                      <Td>{dateOnly(s.sale_date)}</Td>
                      <Td>{s.branch.name}</Td>
                      <Td className="text-muted">{s.customer ?? '—'}</Td>
                      <Td className="num text-right">{integer(s.details.reduce((a, d) => a + d.quantity, 0))}</Td>
                      <Td className="num text-right font-medium">{money(s.total)}</Td>
                      <Td><Badge tone={s.status === 'registrada' ? 'green' : 'red'}>{s.status}</Badge></Td>
                      <Td className="text-right">
                        {s.status === 'registrada' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Anular"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm(`¿Anular la venta #${s.id}? Se devolverá el stock.`)) cancel.mutate(s.id)
                            }}
                          >
                            <Ban className="size-3.5" />
                          </Button>
                        )}
                      </Td>
                    </tr>
                    {expanded === s.id && (
                      <tr>
                        <Td colSpan={9} className="bg-slate-50">
                          <div className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                            {s.details.map((d) => (
                              <div key={d.id} className="flex justify-between rounded border border-line bg-white px-3 py-2">
                                <span>{d.product.name} × {d.quantity}</span>
                                <span className="num text-muted">{money(d.unit_price)} → <b className="text-ink">{money(d.subtotal)}</b></span>
                              </div>
                            ))}
                          </div>
                        </Td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} size={data.size} total={data.total} onPage={(page) => setFilters({ ...filters, page })} />
          </>
        )}
      </Card>
      <NewSaleModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
