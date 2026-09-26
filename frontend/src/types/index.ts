export type RoleName = 'administrador' | 'analista' | 'consulta'

export interface Role {
  id: number
  name: RoleName
  description: string | null
  permissions: string[]
}

export interface User {
  id: number
  email: string
  full_name: string
  dni: string | null
  face_enrolled: boolean
  face_enrolled_at: string | null
  is_active: boolean
  company_id: number | null
  last_login: string | null
  created_at: string | null
  role: Role
  modules?: string[]
}

export interface Company {
  id: number
  name: string
  legal_name: string | null
  ruc: string | null
  sector: string | null
  address: string | null
  phone: string | null
  email: string | null
  currency: string
}

export interface Branch {
  id: number
  company_id: number
  code: string
  name: string
  city: string
  address: string | null
  manager: string | null
  is_active: boolean
}

export interface Category {
  id: number
  name: string
  description: string | null
}

export interface Product {
  id: number
  sku: string
  name: string
  category_id: number | null
  unit_price: number
  unit_cost: number
  is_active: boolean
  category: Category | null
}

interface Mini {
  id: number
  name: string
}
export interface BranchMini extends Mini {
  code: string
  city: string
}
export interface ProductMini extends Mini {
  sku: string
}

export interface SaleDetail {
  id: number
  product_id: number
  quantity: number
  unit_price: number
  subtotal: number
  product: ProductMini
}

export interface Sale {
  id: number
  branch_id: number
  sale_date: string
  customer: string | null
  total: number
  status: 'registrada' | 'anulada'
  branch: BranchMini
  details: SaleDetail[]
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface InventoryItem {
  id: number
  branch_id: number
  product_id: number
  stock: number
  min_stock: number
  branch: BranchMini
  product: ProductMini
}

export interface Movement {
  id: number
  branch_id: number
  product_id: number
  movement_type: 'entrada' | 'salida' | 'ajuste'
  quantity: number
  reason: string | null
  created_at: string
  branch: BranchMini
  product: ProductMini
}

export interface Target {
  id: number
  branch_id: number
  product_id: number
  period: string
  target_quantity: number
  target_amount: number
  branch: BranchMini
  product: ProductMini
}

export interface Vector {
  id: number
  name: string
  description: string | null
  dimension: number
  labels: string[] | null
  source: string
  created_at: string | null
  values: number[]
}

export interface Matrix {
  id: number
  name: string
  description: string | null
  rows: number
  cols: number
  row_labels: string[] | null
  col_labels: string[] | null
  source: string
  created_at: string | null
  values: number[][]
}

export type OperationType =
  | 'vector_add'
  | 'vector_subtract'
  | 'vector_scalar'
  | 'dot_product'
  | 'matrix_add'
  | 'matrix_subtract'
  | 'matrix_scalar'
  | 'matrix_multiply'
  | 'matrix_transpose'
  | 'linear_combination'

export interface OperandIn {
  kind: 'vector' | 'matrix'
  id?: number
  values?: number[] | number[][]
  label?: string
  row_labels?: string[] | null
  col_labels?: string[] | null
}

export interface OperationCreate {
  operation_type: OperationType
  operands: OperandIn[]
  scalar?: number
  coefficients?: number[]
  description?: string
  save_result_as?: string
}

export interface OperationResult {
  result_kind: 'scalar' | 'vector' | 'matrix'
  values: number | number[] | number[][]
  shape: number[]
  interpretation: string | null
  labels: { rows?: string[] | null; cols?: string[] | null } | null
  saved_vector_id: number | null
  saved_matrix_id: number | null
}

export interface OperationInput {
  position: number
  operand_kind: 'vector' | 'matrix'
  label: string | null
  vector_id: number | null
  matrix_id: number | null
  values: number[] | number[][]
  shape: number[]
}

export interface Operation {
  id: number
  operation_type: OperationType
  description: string | null
  status: 'success' | 'error'
  scalar: number | null
  coefficients: number[] | null
  duration_ms: number | null
  error_message: string | null
  user_id: number | null
  created_at: string | null
  inputs: OperationInput[]
  result: OperationResult | null
}

export type OperationSummary = Omit<Operation, 'inputs' | 'result' | 'scalar' | 'coefficients'>

export interface AuditLog {
  id: number
  user_id: number | null
  user_email: string | null
  action: string
  module: string
  entity_id: string | null
  status: string
  detail: Record<string, unknown> | null
  ip_address: string | null
  created_at: string | null
}

export interface Dashboard {
  period: string
  kpis: {
    revenue: number
    units: number
    sales_count: number
    avg_ticket: number
    gross_margin: number
    margin_pct: number
    compliance_pct: number | null
    low_stock: number
    operations: number
    operations_success_rate: number | null
  }
  sales_by_branch: { branch: string; amount: number; units: number; share: number }[]
  sales_by_product: { product: string; amount: number; units: number; share: number }[]
  compliance_by_branch: ComplianceRow[]
  monthly_trend: { period: string; amount: number; sales: number }[]
  inventory_by_product: { product: string; stock: number; sold: number; rotation: number }[]
  low_stock: RotationRow[]
  recent_activity: { id: number; user: string | null; action: string; module: string; status: string; created_at: string | null }[]
  formulas: Record<string, string>
}

export interface ComplianceRow {
  branch?: string
  product?: string
  actual: number
  target: number
  gap: number
  pct: number | null
}

export interface RotationRow {
  branch: string
  product: string
  stock: number
  sold: number
  rotation: number
  coverage_days: number | null
  min_stock: number
}

export interface Compliance {
  period: string
  formula: string
  total: ComplianceRow
  by_branch: ComplianceRow[]
  by_product: ComplianceRow[]
  gap_matrix: { rows: string[]; cols: string[]; values: number[][] }
}

export interface PerformanceIndex {
  period: string
  weights: Record<string, number>
  formula: string
  items: {
    rank: number
    branch: string
    sales: number
    margin: number
    compliance_pct: number
    rotation: number
    components: number[]
    index: number
  }[]
}

export interface Rotation {
  days: number
  formula: string
  items: RotationRow[]
  by_product: { product: string; stock: number; sold: number; rotation: number }[]
  alerts: RotationRow[]
}

export interface OperationsStats {
  total: number
  success: number
  errors: number
  success_rate: number | null
  by_type: { operation_type: string; success: number; error: number; avg_ms: number }[]
}

export interface LoginSession {
  id: number
  method: 'password' | 'face'
  status: 'success' | 'error'
  reason: string | null
  ip_address: string | null
  location_source: 'gps' | 'ip' | 'none' | null
  country: string | null
  department: string | null
  province: string | null
  district: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
  face_distance: number | null
  created_at: string | null
  user?: string | null
  identifier?: string | null
}

export interface DayActivity {
  date: string
  events: number
  logins: number
  operations: number
}

export interface TopUser {
  user_id: number
  name: string
  role: RoleName
  events: number
  operations: number
}

export interface Carnet {
  code: string
  verification: string
  issued_at: string
  valid_until: string
  user: { id: number; full_name: string; email: string; dni: string | null; role: RoleName; photo: string | null; face_enrolled: boolean; member_since: string | null }
  company: { name: string; legal_name: string | null; ruc: string | null } | null
  current_session: LoginSession | null
  recent_sessions: LoginSession[]
  activity_7d: DayActivity[]
  company_activity_7d: DayActivity[]
  totals_7d: { events: number; logins: number; operations: number }
  modules_7d: { module: string; events: number }[]
  top_users: TopUser[]
}

export interface FaceMatch {
  distance: number
  similarity: number
  threshold: number
}

export interface Kpis {
  period: string
  kpis: { revenue: number; units: number; sales_count: number; avg_ticket: number; gross_margin: number; margin_pct: number; compliance_pct: number | null; low_stock: number }
  compliance_by_branch: ComplianceRow[]
}

export interface RecentActivity {
  id: number
  user: string | null
  action: string
  module: string
  status: string
  created_at: string | null
}
