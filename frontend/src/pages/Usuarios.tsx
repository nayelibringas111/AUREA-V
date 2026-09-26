import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td, Th } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { dateTime, ROLE_LABELS } from '@/lib/utils'
import { userSchema, type UserForm } from '@/schemas'
import { errorMessage } from '@/services/api'
import { userApi } from '@/services/endpoints'
import type { User } from '@/types'

function UserModal({ user, open, onClose }: { user: User | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const roles = useQuery({ queryKey: ['roles'], queryFn: userApi.roles })
  const form = useForm<UserForm>({
    resolver: zodResolver(user ? userSchema : userSchema.refine((d) => d.password.length >= 8, { message: 'Mínimo 8 caracteres', path: ['password'] })),
    values: user
      ? { email: user.email, full_name: user.full_name, password: '', role_id: user.role.id, is_active: user.is_active }
      : ({ email: '', full_name: '', password: '', role_id: '', is_active: true } as unknown as UserForm),
  })
  const save = useMutation({
    mutationFn: (d: UserForm) => {
      const v = userSchema.parse(d)
      if (user) return userApi.update(user.id, { full_name: v.full_name, role_id: v.role_id, is_active: v.is_active, ...(v.password ? { password: v.password } : {}) })
      return userApi.create({ email: v.email, full_name: v.full_name, password: v.password, role_id: v.role_id })
    },
    onSuccess: () => {
      toast.success('Usuario guardado')
      qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const e = form.formState.errors
  return (
    <Modal open={open} onClose={onClose} title={user ? 'Editar usuario' : 'Nuevo usuario'}>
      <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="space-y-4">
        <Field label="Correo" error={e.email?.message}><Input {...form.register('email')} disabled={!!user} /></Field>
        <Field label="Nombre completo" error={e.full_name?.message}><Input {...form.register('full_name')} /></Field>
        <Field label={user ? 'Nueva contraseña (opcional)' : 'Contraseña'} error={e.password?.message}><Input type="password" autoComplete="new-password" {...form.register('password')} /></Field>
        <Field label="Rol" error={e.role_id?.message}>
          <Select {...form.register('role_id')}>
            <option value="">Seleccione…</option>
            {roles.data?.map((r) => <option key={r.id} value={r.id}>{ROLE_LABELS[r.name]} — {r.description}</option>)}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('is_active')} className="size-4 accent-primary" /> Activo</label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={save.isPending}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Usuarios() {
  const { user: me } = useAuth()
  const { data, isLoading, error } = useQuery({ queryKey: ['users'], queryFn: userApi.list })
  const [editing, setEditing] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Cuentas y roles: Administrador (acceso total), Analista (operación y análisis) y Consulta (dashboard y reportes)."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setOpen(true) }}>Nuevo usuario</Button>}
      />
      <Card>
        {isLoading && <Spinner />}
        {error && <ErrorBox message={errorMessage(error)} />}
        {data && (
          <Table>
            <thead><tr><Th>Nombre</Th><Th>Correo</Th><Th>Rol</Th><Th>Último acceso</Th><Th>Estado</Th><Th /></tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className={u.is_active ? '' : 'opacity-60'}>
                  <Td className="font-medium">{u.full_name} {u.id === me?.id && <Badge tone="blue" className="ml-1">Usted</Badge>}</Td>
                  <Td>{u.email}</Td>
                  <Td><Badge tone={u.role.name === 'administrador' ? 'blue' : u.role.name === 'analista' ? 'cyan' : 'slate'}>{ROLE_LABELS[u.role.name]}</Badge></Td>
                  <Td className="text-xs text-muted">{dateTime(u.last_login)}</Td>
                  <Td><Badge tone={u.is_active ? 'green' : 'slate'}>{u.is_active ? 'Activo' : 'Inactivo'}</Badge></Td>
                  <Td><Button size="sm" variant="ghost" onClick={() => { setEditing(u); setOpen(true) }} aria-label="Editar"><Pencil className="size-3.5" /></Button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <UserModal user={editing} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
