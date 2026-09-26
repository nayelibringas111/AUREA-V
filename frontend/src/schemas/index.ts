import { z } from 'zod'

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

export const loginSchema = z.object({
  email: z.string().trim().email('Ingrese un correo válido'),
  password: z.string().min(1, 'Ingrese su contraseña'),
})
export type LoginForm = z.infer<typeof loginSchema>

export const companySchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres'),
  legal_name: optionalText,
  ruc: z
    .string()
    .trim()
    .regex(/^(\d{11})?$/, 'El RUC debe tener 11 dígitos')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  sector: optionalText,
  address: optionalText,
  phone: optionalText,
  email: z
    .string()
    .trim()
    .email('Correo inválido')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  currency: z.string().trim().length(3, 'Código ISO de 3 letras'),
})
export type CompanyForm = z.input<typeof companySchema>

export const branchSchema = z.object({
  code: z.string().trim().min(1, 'Requerido').max(20),
  name: z.string().trim().min(2, 'Mínimo 2 caracteres'),
  city: z.string().trim().min(2, 'Requerido'),
  address: optionalText,
  manager: optionalText,
  is_active: z.boolean(),
})
export type BranchForm = z.input<typeof branchSchema>

export const productSchema = z
  .object({
    sku: z.string().trim().min(1, 'Requerido'),
    name: z.string().trim().min(2, 'Mínimo 2 caracteres'),
    category_id: z.coerce.number().int().positive().nullable().or(z.literal('').transform(() => null)),
    unit_price: z.coerce.number({ invalid_type_error: 'Número' }).positive('Debe ser mayor que 0'),
    unit_cost: z.coerce.number({ invalid_type_error: 'Número' }).min(0, 'No puede ser negativo'),
    is_active: z.boolean(),
  })
  .refine((d) => d.unit_cost <= d.unit_price, { message: 'El costo no debería superar el precio', path: ['unit_cost'] })
export type ProductForm = z.input<typeof productSchema>

export const userSchema = z.object({
  email: z.string().trim().email('Correo inválido'),
  full_name: z.string().trim().min(3, 'Mínimo 3 caracteres'),
  password: z.string().min(8, 'Mínimo 8 caracteres').or(z.literal('')),
  role_id: z.coerce.number().int().positive('Seleccione un rol'),
  is_active: z.boolean(),
})
export type UserForm = z.input<typeof userSchema>

export const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Requerido'),
    new_password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm: z.string(),
  })
  .refine((d) => d.new_password === d.confirm, { message: 'Las contraseñas no coinciden', path: ['confirm'] })
export type PasswordForm = z.infer<typeof passwordSchema>

export const movementSchema = z.object({
  branch_id: z.coerce.number().int().positive('Seleccione sucursal'),
  product_id: z.coerce.number().int().positive('Seleccione producto'),
  movement_type: z.enum(['entrada', 'salida', 'ajuste']),
  quantity: z.coerce.number().int('Entero').min(0, 'No negativo'),
  reason: z.string().trim().optional(),
})
export type MovementForm = z.input<typeof movementSchema>
