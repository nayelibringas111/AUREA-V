import type { ReactNode } from 'react'
import { money } from '@/lib/utils'

/** Paleta categórica validada (orden fijo, nunca cíclico) — skill dataviz / palette.md */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300']
export const INK = { primary: '#0f172a', secondary: '#64748b', grid: '#eef2f6' }
export const TARGET_GRAY = '#94a3b8'

export const axisProps = {
  tick: { fill: INK.secondary, fontSize: 11 },
  axisLine: false,
  tickLine: false,
} as const

interface TooltipPayload {
  name?: string
  value?: number
  color?: string
  dataKey?: string | number
}

export function ChartTooltip({
  active,
  payload,
  label,
  format = money,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: ReactNode
  format?: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg">
      {label != null && <div className="mb-1 font-semibold text-ink">{label}</div>}
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 text-slate-600">
          <span className="size-2 rounded-sm" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="num ml-auto pl-3 font-medium text-ink">{format(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
