import axios, { AxiosError } from 'axios'

/**
 * URL base de la API.
 *  - Producción (Vercel): definir VITE_API_URL, p. ej. https://matrixflow-api.onrender.com/api/v1
 *  - Desarrollo: se usa /api/v1 y Vite lo redirige a http://localhost:8000
 */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api/v1'

const TOKEN_KEY = 'mf_token'

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t)
    } catch {
      /* almacenamiento no disponible */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* almacenamiento no disponible */
    }
  },
}

export const api = axios.create({ baseURL: API_URL, timeout: 60000 })

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      tokenStore.clear()
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login?expired=1')
    }
    return Promise.reject(error)
  },
)

/** Extrae un mensaje legible de un error de Axios/FastAPI. */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return 'No se pudo conectar con el servidor. Si es el primer acceso del día, el servidor puede tardar ~1 minuto en iniciar.'
    }
    const detail = (err.response.data as { detail?: unknown })?.detail
    if (typeof detail === 'string') return detail
    if (detail && typeof detail === 'object' && 'message' in detail) return String((detail as { message: string }).message)
    if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).join(', ')
    return `Error ${err.response.status}`
  }
  return err instanceof Error ? err.message : 'Error inesperado'
}

/** Descarga un archivo protegido (CSV) con el token actual. */
export async function downloadFile(path: string, filename: string) {
  const res = await api.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
