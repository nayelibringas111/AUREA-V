import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { tokenStore } from '@/services/api'
import { authApi } from '@/services/endpoints'
import type { User } from '@/types'

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  can: (module: string) => boolean
  isAdmin: boolean
  isStaff: boolean
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const hasToken = !!tokenStore.get()
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: hasToken,
    retry: 1,
    staleTime: 5 * 60_000,
  })

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password)
      tokenStore.set(res.access_token)
      const me = await authApi.me()
      qc.setQueryData(['me'], me)
      return me
    },
    [qc],
  )

  const logout = useCallback(() => {
    tokenStore.clear()
    qc.clear()
    window.location.assign('/login')
  }, [qc])

  const value = useMemo<AuthCtx>(() => {
    const user = hasToken ? (data ?? null) : null
    const modules = user?.modules ?? []
    return {
      user,
      loading: hasToken && isLoading,
      login,
      logout,
      can: (m: string) => modules.includes(m),
      isAdmin: user?.role.name === 'administrador',
      isStaff: user?.role.name === 'administrador' || user?.role.name === 'analista',
    }
  }, [data, hasToken, isLoading, login, logout])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
