import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Coins, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { MatrixEditor, toNumberGrid, VectorView } from '@/components/MatrixViews'
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import { dateTime, number } from '@/lib/utils'
import { errorMessage } from '@/services/api'
import { vectorApi } from '@/services/endpoints'
import type { Vector } from '@/types'

function VectorModal({ vector, open, onClose }: { vector: Vector | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(vector?.name ?? '')
  const [description, setDescription] = useState(vector?.description ?? '')
  const [values, setValues] = useState<(number | string)[][]>([vector?.values ?? [0, 0, 0]])
  const [labels, setLabels] = useState<string[]>(vector?.labels ?? (vector ? vector.values.map(() => '') : ['', '', '']))
  const grid = toNumberGrid(values)
  const save = useMutation({
    mutationFn: () => {
      const body = { name, description, values: grid![0], labels: labels.some((l) => l.trim()) ? labels.map((l, i) => l.trim() || `e${i + 1}`) : null }
      return vector ? vectorApi.update(vector.id, body) : vectorApi.create(body)
    },
    onSuccess: () => {
      toast.success('Vector guardado')
      qc.invalidateQueries({ queryKey: ['vectors'] })
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Modal open={open} onClose={onClose} title={vector ? 'Editar vector' : 'Nuevo vector'} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ventas enero por producto" /></Field>
        <Field label="Descripción"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs text-muted">Etiquetas (opcional) en la primera fila; valores numéricos debajo.</p>
        <MatrixEditor vector values={values} onChange={setValues} colLabels={labels} onColLabels={setLabels} maxCols={30} />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-xs text-red-600">{!grid ? 'Hay celdas vacías o no numéricas.' : ''}</span>
        <Button disabled={!grid || !name.trim()} loading={save.isPending} onClick={() => save.mutate()}>Guardar vector</Button>
      </div>
    </Modal>
  )
}

export default function Vectores() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['vectors'], queryFn: vectorApi.list })
  const [editing, setEditing] = useState<Vector | null>(null)
  const [open, setOpen] = useState(false)
  const [modalKey, setModalKey] = useState(0)
  const gen = useMutation({
    mutationFn: (field: 'unit_price' | 'unit_cost' | 'margin') => vectorApi.fromProducts(field),
    onSuccess: (v) => {
      toast.success(`Vector "${v.name}" generado desde el catálogo`)
      qc.invalidateQueries({ queryKey: ['vectors'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: vectorApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vectors'] }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const openModal = (v: Vector | null) => {
    setEditing(v)
    setModalKey((k) => k + 1)
    setOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Vectores"
        description="Información empresarial unidimensional: precios, costos o ventas de una sucursal por producto."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => openModal(null)}>Nuevo vector</Button>}
      />
      <Card title="Generar desde el catálogo" subtitle="Crea un vector con un componente por producto activo (en orden de SKU)." className="mb-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Coins className="size-4" />} loading={gen.isPending && gen.variables === 'unit_price'} onClick={() => gen.mutate('unit_price')}>Precios (p)</Button>
          <Button variant="secondary" icon={<Coins className="size-4" />} loading={gen.isPending && gen.variables === 'unit_cost'} onClick={() => gen.mutate('unit_cost')}>Costos (c)</Button>
          <Button variant="secondary" icon={<Coins className="size-4" />} loading={gen.isPending && gen.variables === 'margin'} onClick={() => gen.mutate('margin')}>Margen (p − c)</Button>
        </div>
      </Card>
      {isLoading && <Spinner />}
      {error && <ErrorBox message={errorMessage(error)} />}
      {data && data.length === 0 && <EmptyState title="Aún no hay vectores" action={<Button onClick={() => openModal(null)}>Crear vector</Button>} />}
      <div className="grid gap-4 lg:grid-cols-2">
        {data?.map((v) => (
          <Card
            key={v.id}
            title={v.name}
            subtitle={`dim ${v.dimension} · ‖v‖ = ${number(Math.hypot(...v.values))} · ${dateTime(v.created_at)}`}
            actions={
              <>
                <Badge tone="cyan">{v.source}</Badge>
                <Button size="sm" variant="ghost" onClick={() => openModal(v)} aria-label="Editar"><Pencil className="size-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => confirm(`¿Eliminar "${v.name}"?`) && remove.mutate(v.id)} aria-label="Eliminar"><Trash2 className="size-3.5" /></Button>
              </>
            }
          >
            <VectorView values={v.values} labels={v.labels} />
            {v.description && <p className="mt-2 text-xs text-muted">{v.description}</p>}
          </Card>
        ))}
      </div>
      <VectorModal key={modalKey} vector={editing} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
