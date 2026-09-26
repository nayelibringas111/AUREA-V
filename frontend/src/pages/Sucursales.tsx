import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Power } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Spinner, Table, Td, Th } from '@/components/ui'
import { branchSchema, type BranchForm } from '@/schemas'
import { errorMessage } from '@/services/api'
import { branchApi } from '@/services/endpoints'
import type { Branch } from '@/types'

function BranchModal({ branch, open, onClose }: { branch: Branch | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const form = useForm<BranchForm>({
    resolver: zodResolver(branchSchema),
    values: branch
      ? { ...branch, address: branch.address ?? '', manager: branch.manager ?? '' }
      : { code: '', name: '', city: '', address: '', manager: '', is_active: true },
  })
  const save = useMutation({
    mutationFn: (d: Partial<Branch>) => (branch ? branchApi.update(branch.id, d) : branchApi.create(d)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      toast.success(branch ? 'Sucursal actualizada' : 'Sucursal registrada')
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const e = form.formState.errors
  return (
    <Modal open={open} onClose={onClose} title={branch ? 'Editar sucursal' : 'Nueva sucursal'}>
      <form onSubmit={form.handleSubmit((d) => save.mutate(branchSchema.parse(d) as Partial<Branch>))} className="grid grid-cols-2 gap-4">
        <Field label="Código" error={e.code?.message}>
          <Input {...form.register('code')} placeholder="LIM" />
        </Field>
        <Field label="Ciudad" error={e.city?.message}>
          <Input {...form.register('city')} />
        </Field>
        <Field label="Nombre" error={e.name?.message} className="col-span-2">
          <Input {...form.register('name')} placeholder="Sede Lima" />
        </Field>
        <Field label="Dirección" error={e.address?.message} className="col-span-2">
          <Input {...form.register('address')} />
        </Field>
        <Field label="Responsable" error={e.manager?.message}>
          <Input {...form.register('manager')} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" {...form.register('is_active')} className="size-4 accent-primary" /> Activa
        </label>
        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={save.isPending}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Sucursales() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['branches'], queryFn: branchApi.list })
  const [editing, setEditing] = useState<Branch | null>(null)
  const [open, setOpen] = useState(false)
  const toggle = useMutation({
    mutationFn: (b: Branch) => branchApi.update(b.id, { is_active: !b.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <>
      <PageHeader
        title="Sucursales"
        description="Sedes operativas. Cada sucursal activa es una fila de las matrices sucursal × producto."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setOpen(true) }}>Nueva sucursal</Button>}
      />
      <Card>
        {isLoading && <Spinner />}
        {error && <ErrorBox message={errorMessage(error)} />}
        {data && data.length === 0 && <EmptyState title="Sin sucursales" />}
        {data && data.length > 0 && (
          <Table>
            <thead>
              <tr>
                <Th>Código</Th><Th>Nombre</Th><Th>Ciudad</Th><Th>Dirección</Th><Th>Responsable</Th><Th>Estado</Th><Th />
              </tr>
            </thead>
            <tbody>
              {data.map((b) => (
                <tr key={b.id} className={b.is_active ? '' : 'opacity-60'}>
                  <Td className="font-mono text-xs font-semibold">{b.code}</Td>
                  <Td className="font-medium">{b.name}</Td>
                  <Td>{b.city}</Td>
                  <Td className="text-muted">{b.address}</Td>
                  <Td>{b.manager}</Td>
                  <Td><Badge tone={b.is_active ? 'green' : 'slate'}>{b.is_active ? 'Activa' : 'Inactiva'}</Badge></Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(b); setOpen(true) }} aria-label="Editar"><Pencil className="size-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => toggle.mutate(b)} aria-label={b.is_active ? 'Desactivar' : 'Activar'}><Power className="size-3.5" /></Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <BranchModal branch={editing} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
