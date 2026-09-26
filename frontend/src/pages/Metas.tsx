import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, ErrorBox, PageHeader, Select, Spinner } from '@/components/ui'
import { cn, currentPeriod, lastPeriods, money, monthLabel } from '@/lib/utils'
import { errorMessage } from '@/services/api'
import { branchApi, productApi, targetApi } from '@/services/endpoints'

/** Editor de la matriz de metas T (sucursal × producto) en unidades. El importe = unidades × precio. */
export default function Metas() {
  const qc = useQueryClient()
  const next = lastPeriods(1, new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1))[0]
  const [period, setPeriod] = useState(currentPeriod())
  const branches = useQuery({ queryKey: ['branches'], queryFn: branchApi.list })
  const products = useQuery({ queryKey: ['products'], queryFn: productApi.list })
  const targets = useQuery({ queryKey: ['targets', period], queryFn: () => targetApi.list({ period }) })
  const [grid, setGrid] = useState<Record<string, string>>({})
  const bs = useMemo(() => branches.data?.filter((b) => b.is_active) ?? [], [branches.data])
  const ps = useMemo(() => products.data?.filter((p) => p.is_active) ?? [], [products.data])

  useEffect(() => {
    const g: Record<string, string> = {}
    targets.data?.forEach((t) => (g[`${t.branch_id}-${t.product_id}`] = String(t.target_quantity)))
    setGrid(g)
  }, [targets.data])

  const original = useMemo(() => {
    const g: Record<string, string> = {}
    targets.data?.forEach((t) => (g[`${t.branch_id}-${t.product_id}`] = String(t.target_quantity)))
    return g
  }, [targets.data])
  const dirty = Object.keys(grid).filter((k) => grid[k] !== original[k] && grid[k] !== '')

  const save = useMutation({
    mutationFn: async () => {
      for (const key of dirty) {
        const [branch_id, product_id] = key.split('-').map(Number)
        const q = Math.max(0, Math.round(Number(grid[key])))
        const price = ps.find((p) => p.id === product_id)?.unit_price ?? 0
        await targetApi.upsert({ branch_id, product_id, period, target_quantity: q, target_amount: q * price })
      }
    },
    onSuccess: () => {
      toast.success(`${dirty.length} meta(s) guardada(s)`)
      qc.invalidateQueries({ queryKey: ['targets'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const rowTotal = (bid: number) => ps.reduce((s, p) => s + Number(grid[`${bid}-${p.id}`] || 0) * p.unit_price, 0)

  return (
    <>
      <PageHeader
        title="Metas"
        description="Matriz de metas T (unidades por sucursal × producto). El importe se calcula como T · diag(p). Se usa en la resta A − T y en el cumplimiento."
        actions={
          <>
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44" aria-label="Periodo">
              {[next, ...lastPeriods(7)].map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}
            </Select>
            <Button icon={<Save className="size-4" />} disabled={dirty.length === 0} loading={save.isPending} onClick={() => save.mutate()}>
              Guardar {dirty.length > 0 ? `(${dirty.length})` : ''}
            </Button>
          </>
        }
      />
      <Card title={`Metas en unidades · ${monthLabel(period)}`} subtitle="Edite las celdas; los cambios se resaltan hasta guardarlos.">
        {(targets.isLoading || branches.isLoading) && <Spinner />}
        {targets.error && <ErrorBox message={errorMessage(targets.error)} />}
        {targets.data && (
          <div className="scroll-thin overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="px-2 pb-2 text-left text-xs font-medium text-muted">Sucursal</th>
                  {ps.map((p) => <th key={p.id} className="px-2 pb-2 text-right text-xs font-medium text-muted">{p.name}</th>)}
                  <th className="px-2 pb-2 text-right text-xs font-medium text-muted">Importe meta</th>
                </tr>
              </thead>
              <tbody>
                {bs.map((b) => (
                  <tr key={b.id}>
                    <td className="pr-4 text-sm font-medium whitespace-nowrap">{b.name}</td>
                    {ps.map((p) => {
                      const key = `${b.id}-${p.id}`
                      return (
                        <td key={p.id} className="p-1">
                          <input
                            type="number"
                            min={0}
                            value={grid[key] ?? ''}
                            placeholder="0"
                            onChange={(e) => setGrid({ ...grid, [key]: e.target.value })}
                            className={cn(
                              'num h-8 w-24 rounded border px-2 text-right font-mono text-xs focus:border-primary focus:outline-none',
                              grid[key] !== original[key] && grid[key] !== '' ? 'border-amber-400 bg-amber-50' : 'border-line',
                            )}
                            aria-label={`Meta ${b.name} ${p.name}`}
                          />
                        </td>
                      )
                    })}
                    <td className="num px-2 text-right text-xs font-medium">{money(rowTotal(b.id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
