/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL completa de la API, p. ej. https://matrixflow-api.onrender.com/api/v1 */
  readonly VITE_API_URL?: string
  /** 'true' para mostrar los usuarios de demostración en el login */
  readonly VITE_SHOW_DEMO_USERS?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
