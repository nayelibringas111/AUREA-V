import { api } from './api'
import type { GeoPoint } from '@/lib/geo'
import type {
  AuditLog,
  Carnet,
  DayActivity,
  FaceMatch,
  Kpis,
  LoginSession,
  RecentActivity,
  TopUser,
  Branch,
  Category,
  Company,
  Compliance,
  Dashboard,
  InventoryItem,
  Matrix,
  Movement,
  Operation,
  OperationCreate,
  OperationSummary,
  OperationsStats,
  Page,
  PerformanceIndex,
  Product,
  Role,
  Rotation,
  Sale,
  Target,
  User,
  Vector,
} from '@/types'

const get = <T>(url: string, params?: object) => api.get<T>(url, { params }).then((r) => r.data)
const post = <T>(url: string, body?: unknown) => api.post<T>(url, body).then((r) => r.data)
const put = <T>(url: string, body?: unknown) => api.put<T>(url, body).then((r) => r.data)
const patch = <T>(url: string, body?: unknown) => api.patch<T>(url, body).then((r) => r.data)
const del = (url: string) => api.delete(url).then(() => undefined)

export interface FaceLoginBody {
  dni: string
  descriptor: number[]
  liveness: boolean
  brightness?: number
  location?: GeoPoint | null
}
export const authApi = {
  login: (email: string, password: string, location?: GeoPoint | null) =>
    post<{ access_token: string; user: User; expires_in: number }>('/auth/login', { email, password, location: location ?? undefined }),
  faceLogin: (b: FaceLoginBody) =>
    post<{ access_token: string; user: User; expires_in: number; match: FaceMatch }>('/auth/face-login', { ...b, location: b.location ?? undefined }),
  me: () => get<User>('/auth/me'),
  carnet: () => get<Carnet>('/auth/carnet'),
  changePassword: (current_password: string, new_password: string) =>
    post('/auth/change-password', { current_password, new_password }),
}

export const companyApi = {
  current: () => get<Company>('/companies/current'),
  update: (data: Partial<Company>) => patch<Company>('/companies/current', data),
}

export const branchApi = {
  list: () => get<Branch[]>('/branches'),
  create: (d: Partial<Branch>) => post<Branch>('/branches', d),
  update: (id: number, d: Partial<Branch>) => patch<Branch>(`/branches/${id}`, d),
  remove: (id: number) => del(`/branches/${id}`),
}

export const productApi = {
  list: () => get<Product[]>('/products'),
  create: (d: Partial<Product>) => post<Product>('/products', d),
  update: (id: number, d: Partial<Product>) => patch<Product>(`/products/${id}`, d),
  remove: (id: number) => del(`/products/${id}`),
  categories: () => get<Category[]>('/categories'),
  createCategory: (d: { name: string; description?: string }) => post<Category>('/categories', d),
}

export interface SaleFilters {
  branch_id?: number
  date_from?: string
  date_to?: string
  status?: string
  page?: number
  size?: number
}
export const salesApi = {
  list: (f: SaleFilters) => get<Page<Sale>>('/sales', f),
  create: (d: { branch_id: number; sale_date: string; customer?: string; details: { product_id: number; quantity: number }[] }) =>
    post<Sale>('/sales', d),
  cancel: (id: number) => post<Sale>(`/sales/${id}/cancel`),
}

export const inventoryApi = {
  list: (params?: { branch_id?: number; low_stock?: boolean }) => get<InventoryItem[]>('/inventory', params),
  updateMin: (id: number, min_stock: number) => patch<InventoryItem>(`/inventory/${id}`, { min_stock }),
  movements: (params?: { branch_id?: number; product_id?: number; limit?: number }) =>
    get<Movement[]>('/inventory/movements', params),
  move: (d: { branch_id: number; product_id: number; movement_type: string; quantity: number; reason?: string }) =>
    post<Movement>('/inventory/movements', d),
}

export const targetApi = {
  list: (params?: { period?: string; branch_id?: number }) => get<Target[]>('/targets', params),
  periods: () => get<string[]>('/targets/periods'),
  upsert: (d: Omit<Target, 'id' | 'branch' | 'product'>) => put<Target>('/targets', d),
}

export const vectorApi = {
  list: () => get<Vector[]>('/vectors'),
  create: (d: { name: string; description?: string; values: number[]; labels?: string[] | null }) => post<Vector>('/vectors', d),
  update: (id: number, d: { name: string; description?: string | null; values: number[]; labels?: string[] | null }) =>
    put<Vector>(`/vectors/${id}`, d),
  remove: (id: number) => del(`/vectors/${id}`),
  fromProducts: (field: 'unit_price' | 'unit_cost' | 'margin', name?: string) =>
    post<Vector>('/vectors/from-products', { field, name }),
}

export type MatrixMetric = 'quantity' | 'amount' | 'target_quantity' | 'target_amount' | 'stock'
export interface MatrixFromSales {
  name?: string
  metric: MatrixMetric
  date_from?: string
  date_to?: string
  period?: string
}
export const matrixApi = {
  list: () => get<Matrix[]>('/matrices'),
  create: (d: { name: string; description?: string; values: number[][]; row_labels?: string[] | null; col_labels?: string[] | null }) =>
    post<Matrix>('/matrices', d),
  update: (
    id: number,
    d: { name: string; description?: string | null; values: number[][]; row_labels?: string[] | null; col_labels?: string[] | null },
  ) => put<Matrix>(`/matrices/${id}`, d),
  remove: (id: number) => del(`/matrices/${id}`),
  fromSales: (d: MatrixFromSales) => post<Matrix>('/matrices/from-sales', d),
  preview: (d: MatrixFromSales) => post<Matrix>('/matrices/preview-from-sales', d),
}

export const operationApi = {
  run: (d: OperationCreate) => post<Operation>('/operations', d),
  history: (params: { operation_type?: string; status?: string; page?: number; size?: number }) =>
    get<Page<OperationSummary>>('/operations', params),
  get: (id: number) => get<Operation>(`/operations/${id}`),
}

export const reportApi = {
  kpis: (period?: string) => get<Kpis>('/reports/kpis', { period }),
  recentActivity: (limit = 10) => get<RecentActivity[]>('/reports/recent-activity', { limit }),
  salesByBranch: (date_from?: string, date_to?: string) =>
    get<{ formula: string; items: { branch: string; amount: number; units: number; share: number }[] }>('/reports/sales-by-branch', { date_from, date_to }),
  salesByProduct: (date_from?: string, date_to?: string) =>
    get<{ formula: string; items: { product: string; amount: number; units: number; share: number }[] }>('/reports/sales-by-product', { date_from, date_to }),
  dashboard: (period?: string) => get<Dashboard>('/reports/dashboard', { period }),
  compliance: (period?: string) => get<Compliance>('/reports/target-compliance', { period }),
  rotation: (days = 30) => get<Rotation>('/reports/inventory-rotation', { days }),
  performance: (period: string | undefined, w: { w_sales: number; w_margin: number; w_compliance: number; w_rotation: number }) =>
    get<PerformanceIndex>('/reports/performance-index', { period, ...w }),
  trend: (months = 12) => get<{ items: { period: string; amount: number; sales: number }[] }>('/reports/monthly-trend', { months }),
  operations: () => get<OperationsStats>('/reports/operations-stats'),
}

export interface FaceEnrollBody {
  descriptors: number[][]
  photo: string | null
  consent: boolean
  brightness?: number
}
export const userApi = {
  list: () => get<User[]>('/users'),
  enrollMe: (b: FaceEnrollBody) => post<User>('/users/me/face', b),
  deleteMyFace: () => del('/users/me/face'),
  enrollUser: (id: number, b: FaceEnrollBody) => post<User>(`/users/${id}/face`, b),
  deleteUserFace: (id: number) => del(`/users/${id}/face`),
  roles: () => get<Role[]>('/users/roles'),
  create: (d: { email: string; full_name: string; password: string; role_id: number; dni?: string | null }) => post<User>('/users', d),
  update: (id: number, d: Partial<{ full_name: string; password: string; role_id: number; is_active: boolean; dni: string | null }>) =>
    patch<User>(`/users/${id}`, d),
  remove: (id: number) => del(`/users/${id}`),
}

export const auditApi = {
  list: (params: { module?: string; status?: string; page?: number; size?: number }) => get<Page<AuditLog>>('/audit', params),
  sessions: (params: { method?: string; status?: string; page?: number; size?: number }) => get<Page<LoginSession>>('/audit/sessions', params),
  locations: (days = 30) => get<{ department: string; district: string; logins: number }[]>('/audit/locations', { days }),
  activity: (days = 7) => get<DayActivity[]>('/audit/activity', { days }),
  topUsers: (days = 7) => get<TopUser[]>('/audit/top-users', { days }),
}
