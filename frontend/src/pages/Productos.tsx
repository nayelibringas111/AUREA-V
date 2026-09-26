import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Power, Tags } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td, Th } from '@/components/ui'
import { money, pct } from '@/lib/utils'
import { productSchema, type ProductForm } from '@/schemas'
import { errorMessage } from '@/services/api'
import { productApi } from '@/services/endpoints'
import type { Product } from '@/types'

function ProductModal({ product, open, onClose }: { product: Product | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const cats = useQuery({ queryKey: ['categories'], queryFn: productApi.categories })
  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    values: product
      ? { sku: product.sku, name: product.name, category_id: product.category_id ?? '', unit_price: product.unit_price, unit_cost: product.unit_cost, is_active: product.is_active }
      : ({ sku: '', name: '', category_id: '', unit_price: '', unit_cost: '', is_active: true } as unknown as ProductForm),
  })
  const save = useMutation({
    mutationFn: (d: Partial<Product>) => (product ? productApi.update(product.id, d) : productApi.create(d)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success(product ? 'Producto actualizado' : 'Producto registrado')
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const e = form.formState.errors
  return (
    <Modal open={open} onClose={onClose} title={product ? 'Editar producto' : 'Nuevo producto'}>
      <form onSubmit={form.handleSubmit((d) => save.mutate(productSchema.parse(d) as Partial<Product>))} className="grid grid-cols-2 gap-4">
        <Field label="SKU" error={e.sku?.message}><Input {...form.register('sku')} placeholder="P-006" /></Field>
        <Field label="Categoría" error={e.category_id?.message}>
          <Select {...form.register('category_id')}>
            <option value="">Sin categoría</option>
            {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Nombre" error={e.name?.message} className="col-span-2"><Input {...form.register('name')} /></Field>
        <Field label="Precio unitario (S/)" error={e.unit_price?.message}><Input type="number" step="0.01" {...form.register('unit_price')} /></Field>
        <Field label="Costo unitario (S/)" error={e.unit_cost?.message}><Input type="number" step="0.01" {...form.register('unit_cost')} /></Field>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('is_active')} className="size-4 accent-primary" /> Activo (forma parte de las matrices)
        </label>
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={save.isPending}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}

function CategoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const save = useMutation({
    mutationFn: () => productApi.createCategory({ name, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Categoría creada')
      setName('')
      setDescription('')
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Modal open={open} onClose={onClose} title="Nueva categoría">
      <div className="space-y-4">
        <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Descripción"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="flex justify-end"><Button disabled={name.trim().length < 2} loading={save.isPending} onClick={() => save.mutate()}>Crear</Button></div>
      </div>
    </Modal>
  )
}

export default function Productos() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['products'], queryFn: productApi.list })
  const [editing, setEditing] = useState<Product | null>(null)
  const [open, setOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const toggle = useMutation({
    mutationFn: (p: Product) => productApi.update(p.id, { is_active: !p.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <>
      <PageHeader
        title="Productos"
        description="Catálogo. Cada producto activo es una columna de las matrices y un componente de los vectores de precios y costos."
        actions={
          <>
            <Button variant="secondary" icon={<Tags className="size-4" />} onClick={() => setCatOpen(true)}>Categoría</Button>
            <Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setOpen(true) }}>Nuevo producto</Button>
          </>
        }
      />
      <Card>
        {isLoading && <Spinner />}
        {error && <ErrorBox message={errorMessage(error)} />}
        {data && (
          <Table>
            <thead>
              <tr><Th>SKU</Th><Th>Producto</Th><Th>Categoría</Th><Th className="text-right">Precio</Th><Th className="text-right">Costo</Th><Th className="text-right">Margen</Th><Th>Estado</Th><Th /></tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className={p.is_active ? '' : 'opacity-60'}>
                  <Td className="font-mono text-xs font-semibold">{p.sku}</Td>
                  <Td className="font-medium">{p.name}</Td>
                  <Td>{p.category?.name ?? '—'}</Td>
                  <Td className="num text-right">{money(p.unit_price)}</Td>
                  <Td className="num text-right">{money(p.unit_cost)}</Td>
                  <Td className="num text-right">{pct(((p.unit_price - p.unit_cost) / p.unit_price) * 100)}</Td>
                  <Td><Badge tone={p.is_active ? 'green' : 'slate'}>{p.is_active ? 'Activo' : 'Inactivo'}</Badge></Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true) }} aria-label="Editar"><Pencil className="size-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => toggle.mutate(p)} aria-label="Activar o desactivar"><Power className="size-3.5" /></Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <ProductModal product={editing} open={open} onClose={() => setOpen(false)} />
      <CategoryModal open={catOpen} onClose={() => setCatOpen(false)} />
    </>
  )
}
