import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Pencil, Plus, ScanFace, Trash2, Users as UsersIcon } from 'lucide-react'
import { FaceEnroll } from '@/components/FaceEnroll'
import { ModuleTabs, useTab } from '@/components/ModuleTabs'
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
      ? { email: user.email, full_name: user.full_name, dni: user.dni ?? '', password: '', role_id: user.role.id, is_active: user.is_active }
      : ({ email: '', full_name: '', dni: '', password: '', role_id: '', is_active: true } as unknown as UserForm),
  })
  const save = useMutation({
    mutationFn: (d: UserForm) => {
      const v = userSchema.parse(d)
      if (user) return userApi.update(user.id, { full_name: v.full_name, role_id: v.role_id, is_active: v.is_active, ...(v.dni ? { dni: v.dni } : {}), ...(v.password ? { password: v.password } : {}) })
      return userApi.create({ email: v.email, full_name: v.full_name, password: v.password, role_id: v.role_id, dni: v.dni })
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
        <Field label="DNI" error={e.dni?.message} hint="Necesario para ingresar con reconocimiento facial."><Input inputMode="numeric" maxLength={8} className="font-mono" {...form.register('dni')} /></Field>
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

function EnrollModal({ user, onClose }: { user: User; onClose: () => void }) {
  const qc = useQueryClient()
  return (
    <Modal open onClose={onClose} title={`Registrar rostro · ${user.full_name}`}>
      <p className="mb-4 text-xs text-muted">La persona debe estar frente a la cámara de este equipo.</p>
      <FaceEnroll
        subject={user.full_name}
        submit={(b) => userApi.enrollUser(user.id, b)}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ['users'] })
          onClose()
        }}
      />
    </Modal>
  )
}

function Biometria() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: userApi.list })
  const [enrolling, setEnrolling] = useState<User | null>(null)
  const remove = useMutation({
    mutationFn: userApi.deleteUserFace,
    onSuccess: () => {
      toast.success('Biometría eliminada')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  if (isLoading || !data) return <Spinner />
  const enrolled = data.filter((u) => u.face_enrolled).length
  return (
    <Card title="Registro biométrico" subtitle={`${enrolled} de ${data.length} usuarios con rostro registrado`}>
      <Table>
        <thead><tr><Th>Usuario</Th><Th>DNI</Th><Th>Estado</Th><Th>Registrado</Th><Th /></tr></thead>
        <tbody>
          {data.map((u) => (
            <tr key={u.id}>
              <Td className="font-medium">{u.full_name}</Td>
              <Td className="font-mono text-xs">{u.dni ?? <span className="text-amber-700">sin DNI</span>}</Td>
              <Td>{u.face_enrolled ? <Badge tone="green"><BadgeCheck className="mr-1 size-3" />Registrado</Badge> : <Badge tone="amber">Pendiente</Badge>}</Td>
              <Td className="text-xs text-muted">{dateTime(u.face_enrolled_at)}</Td>
              <Td className="text-right">
                {u.face_enrolled ? (
                  <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => confirm(`¿Eliminar la biometría de ${u.full_name}?`) && remove.mutate(u.id)}>Eliminar</Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled={!u.dni || !u.is_active} icon={<ScanFace className="size-3.5" />} onClick={() => setEnrolling(u)}>Registrar rostro</Button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {enrolling && <EnrollModal user={enrolling} onClose={() => setEnrolling(null)} />}
    </Card>
  )
}

const TABS = ['usuarios', 'biometria'] as const

export default function Usuarios() {
  const [tab, setTab] = useTab(TABS, 'usuarios')
  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Cuentas y roles: Administrador (acceso total), Analista (operación y análisis) y Consulta (dashboard y reportes)."
      />
      <ModuleTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'usuarios', label: 'Usuarios y roles', icon: <UsersIcon className="size-4" /> },
          { value: 'biometria', label: 'Biometría facial', icon: <ScanFace className="size-4" /> },
        ]}
      />
      {tab === 'usuarios' ? <ListaUsuarios /> : <Biometria />}
    </>
  )
}

function ListaUsuarios() {
  const { user: me } = useAuth()
  const { data, isLoading, error } = useQuery({ queryKey: ['users'], queryFn: userApi.list })
  const [editing, setEditing] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <Card title="Usuarios" actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setOpen(true) }}>Nuevo usuario</Button>}>
        {isLoading && <Spinner />}
        {error && <ErrorBox message={errorMessage(error)} />}
        {data && (
          <Table>
            <thead><tr><Th>Nombre</Th><Th>Correo</Th><Th>DNI</Th><Th>Rostro</Th><Th>Rol</Th><Th>Último acceso</Th><Th>Estado</Th><Th /></tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className={u.is_active ? '' : 'opacity-60'}>
                  <Td className="font-medium">{u.full_name} {u.id === me?.id && <Badge tone="blue" className="ml-1">Usted</Badge>}</Td>
                  <Td>{u.email}</Td>
                  <Td className="font-mono text-xs">{u.dni ?? '—'}</Td>
                  <Td>{u.face_enrolled ? <BadgeCheck className="size-4 text-emerald-600" aria-label="Registrado" /> : <span className="text-xs text-muted">—</span>}</Td>
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
