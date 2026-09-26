import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface TabItem<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  badge?: ReactNode
}

/**
 * Pestaña activa sincronizada con la URL (?tab=...). Así cada sección del módulo se puede
 * compartir o recargar, y solo se monta (y consulta a la API) la pestaña visible.
 */
export function useTab<T extends string>(values: readonly T[], fallback: T): [T, (t: T) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as T | null
  const tab = raw && values.includes(raw) ? raw : fallback
  const set = (t: T) => {
    const next = new URLSearchParams(params)
    if (t === fallback) next.delete('tab')
    else next.set('tab', t)
    setParams(next, { replace: true })
  }
  return [tab, set]
}

/** Barra de pestañas de un módulo (desplazable en móvil). */
export function ModuleTabs<T extends string>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('scroll-thin -mx-1 mb-6 overflow-x-auto px-1', className)}>
      <div role="tablist" className="flex min-w-max gap-1 border-b border-line">
        {items.map((it) => {
          const active = it.value === value
          return (
            <button
              key={it.value}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(it.value)}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                active ? 'border-primary text-primary' : 'border-transparent text-muted hover:border-slate-300 hover:text-ink',
              )}
            >
              {it.icon}
              {it.label}
              {it.badge != null && <span className={cn('rounded-full px-1.5 text-[10px]', active ? 'bg-blue-100 text-primary' : 'bg-slate-100 text-muted')}>{it.badge}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
