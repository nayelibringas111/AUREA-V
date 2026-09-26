import { Minus, Plus } from 'lucide-react'
import { cn, number } from '@/lib/utils'

/** Muestra una matriz con etiquetas de fila/columna y resaltado opcional (negativos en rojo). */
export function MatrixView({
  values,
  rowLabels,
  colLabels,
  heat = false,
  diverging = false,
  compact = false,
}: {
  values: number[][]
  rowLabels?: string[] | null
  colLabels?: string[] | null
  heat?: boolean
  diverging?: boolean
  compact?: boolean
}) {
  const flat = values.flat()
  const max = Math.max(...flat.map((v) => Math.abs(v)), 1)
  const cellBg = (v: number) => {
    if (diverging) {
      const a = Math.min(Math.abs(v) / max, 1) * 0.55
      return v < 0 ? `rgba(220,38,38,${a})` : v > 0 ? `rgba(37,99,235,${a})` : undefined
    }
    if (heat) return `rgba(37,99,235,${(Math.abs(v) / max) * 0.45})`
    return undefined
  }
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className={cn('num border-separate border-spacing-0 font-mono', compact ? 'text-[11px]' : 'text-xs')}>
        {colLabels && (
          <thead>
            <tr>
              {rowLabels && <th />}
              {colLabels.map((c, j) => (
                <th key={j} className="px-2 pb-1.5 text-right font-sans text-[11px] font-medium text-muted">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {values.map((row, i) => (
            <tr key={i}>
              {rowLabels && <th className="pr-3 text-left font-sans text-[11px] font-medium whitespace-nowrap text-muted">{rowLabels[i]}</th>}
              {row.map((v, j) => (
                <td
                  key={j}
                  className={cn(
                    'border border-white px-2 py-1 text-right whitespace-nowrap',
                    !heat && !diverging && 'bg-slate-50',
                    v < 0 && !diverging && 'text-red-600',
                  )}
                  style={{ background: cellBg(v) }}
                >
                  {number(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function VectorView({ values, labels }: { values: number[]; labels?: string[] | null }) {
  return (
    <div className="scroll-thin flex gap-1 overflow-x-auto pb-1">
      {values.map((v, i) => (
        <div key={i} className="min-w-16 rounded-md border border-line bg-slate-50 px-2 py-1.5 text-center">
          <div className="truncate text-[10px] text-muted">{labels?.[i] ?? `v${i + 1}`}</div>
          <div className={cn('num font-mono text-xs font-medium', v < 0 && 'text-red-600')}>{number(v)}</div>
        </div>
      ))}
    </div>
  )
}

/** Cuadrícula editable para matrices (o vectores con rows=1). */
export function MatrixEditor({
  values,
  onChange,
  rowLabels,
  colLabels,
  onRowLabels,
  onColLabels,
  maxRows = 12,
  maxCols = 12,
  vector = false,
}: {
  values: (number | string)[][]
  onChange: (v: (number | string)[][]) => void
  rowLabels?: string[]
  colLabels?: string[]
  onRowLabels?: (l: string[]) => void
  onColLabels?: (l: string[]) => void
  maxRows?: number
  maxCols?: number
  vector?: boolean
}) {
  const rows = values.length
  const cols = values[0]?.length ?? 0
  const setCell = (i: number, j: number, raw: string) => {
    const next = values.map((r) => [...r])
    next[i][j] = raw
    onChange(next)
  }
  const resize = (r: number, c: number) => {
    const next = Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => values[i]?.[j] ?? 0))
    onChange(next)
    if (onRowLabels && rowLabels) onRowLabels(Array.from({ length: r }, (_, i) => rowLabels[i] ?? ''))
    if (onColLabels && colLabels) onColLabels(Array.from({ length: c }, (_, j) => colLabels[j] ?? ''))
  }
  const Stepper = ({ label, value, onDec, onInc, max }: { label: string; value: number; onDec: () => void; onInc: () => void; max: number }) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted">{label}</span>
      <button type="button" className="rounded border border-line p-1 disabled:opacity-40" disabled={value <= 1} onClick={onDec} aria-label={`Quitar ${label}`}>
        <Minus className="size-3" />
      </button>
      <span className="num w-5 text-center font-medium">{value}</span>
      <button type="button" className="rounded border border-line p-1 disabled:opacity-40" disabled={value >= max} onClick={onInc} aria-label={`Agregar ${label}`}>
        <Plus className="size-3" />
      </button>
    </div>
  )
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-5">
        {!vector && <Stepper label="Filas" value={rows} max={maxRows} onDec={() => resize(rows - 1, cols)} onInc={() => resize(rows + 1, cols)} />}
        <Stepper label={vector ? 'Dimensión' : 'Columnas'} value={cols} max={maxCols} onDec={() => resize(rows, cols - 1)} onInc={() => resize(rows, cols + 1)} />
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="border-separate border-spacing-1">
          {colLabels && onColLabels && (
            <thead>
              <tr>
                {rowLabels && onRowLabels && <th />}
                {colLabels.map((l, j) => (
                  <th key={j}>
                    <input
                      value={l}
                      placeholder={vector ? `e${j + 1}` : `c${j + 1}`}
                      onChange={(e) => onColLabels(colLabels.map((x, k) => (k === j ? e.target.value : x)))}
                      className="h-7 w-20 rounded border border-dashed border-line px-1.5 text-center text-[11px] text-muted focus:border-primary focus:outline-none"
                      aria-label={`Etiqueta columna ${j + 1}`}
                    />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {values.map((row, i) => (
              <tr key={i}>
                {rowLabels && onRowLabels && (
                  <td>
                    <input
                      value={rowLabels[i] ?? ''}
                      placeholder={`f${i + 1}`}
                      onChange={(e) => onRowLabels(rowLabels.map((x, k) => (k === i ? e.target.value : x)))}
                      className="h-8 w-28 rounded border border-dashed border-line px-1.5 text-[11px] text-muted focus:border-primary focus:outline-none"
                      aria-label={`Etiqueta fila ${i + 1}`}
                    />
                  </td>
                )}
                {row.map((v, j) => {
                  const invalid = v === '' || Number.isNaN(Number(v))
                  return (
                    <td key={j}>
                      <input
                        inputMode="decimal"
                        value={v}
                        onChange={(e) => setCell(i, j, e.target.value)}
                        className={cn(
                          'num h-8 w-20 rounded border px-2 text-right font-mono text-xs focus:outline-none focus:ring-2',
                          invalid ? 'border-red-400 bg-red-50 focus:ring-red-200' : 'border-line focus:border-primary focus:ring-primary/20',
                        )}
                        aria-label={`Celda ${i + 1},${j + 1}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function toNumberGrid(values: (number | string)[][]): number[][] | null {
  const out = values.map((r) => r.map((v) => (v === '' ? NaN : Number(v))))
  return out.flat().some((v) => Number.isNaN(v)) ? null : out
}
