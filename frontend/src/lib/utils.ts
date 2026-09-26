import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

const pen = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 })
const penShort = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', notation: 'compact', maximumFractionDigits: 1 })
const num = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 })
const intFmt = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 })

export const money = (v: number | null | undefined) => (v == null ? '—' : pen.format(v))
export const moneyShort = (v: number | null | undefined) => (v == null ? '—' : penShort.format(v))
export const number = (v: number | null | undefined) => (v == null ? '—' : num.format(v))
export const integer = (v: number | null | undefined) => (v == null ? '—' : intFmt.format(v))
export const pct = (v: number | null | undefined) => (v == null ? '—' : `${num.format(v)} %`)

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export const dateOnly = (iso: string | null | undefined) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const pad = (n: number) => String(n).padStart(2, '0')
export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const currentPeriod = () => today().slice(0, 7)

export function monthLabel(period: string) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-PE', { month: 'short', year: '2-digit' })
}

export function lastPeriods(n: number, from = new Date()) {
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function periodRange(period: string) {
  const [y, m] = period.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { date_from: `${period}-01`, date_to: `${period}-${String(last).padStart(2, '0')}` }
}

/** Convierte texto "1, 2; 3" o líneas en números. */
export function parseNumberList(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((t) => Number(t))
}

export const OPERATION_LABELS: Record<string, string> = {
  vector_add: 'Suma de vectores',
  vector_subtract: 'Resta de vectores',
  vector_scalar: 'Vector por escalar',
  dot_product: 'Producto escalar',
  matrix_add: 'Suma de matrices',
  matrix_subtract: 'Resta de matrices',
  matrix_scalar: 'Matriz por escalar',
  matrix_multiply: 'Multiplicación matricial',
  matrix_transpose: 'Transpuesta',
  linear_combination: 'Combinación lineal',
}

export const ROLE_LABELS: Record<string, string> = {
  administrador: 'Administrador',
  analista: 'Analista',
  consulta: 'Consulta',
}
