import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ModuleTabs, useTab } from '@/components/ModuleTabs'
import { toOperand } from '@/components/OperandPicker'
import { MatrixEditor, MatrixView, toNumberGrid } from '@/components/MatrixViews'
import { AuthProvider } from '@/hooks/useAuth'
import { eyeAspectRatio, meanDescriptor } from '@/lib/face'
import { parseNumberList, periodRange } from '@/lib/utils'
import LoginPage from '@/pages/Login'
import { companySchema, productSchema } from '@/schemas'

describe('utilidades', () => {
  it('parsea listas numéricas', () => {
    expect(parseNumberList('1, 2;3  4')).toEqual([1, 2, 3, 4])
  })
  it('calcula el rango de un periodo', () => {
    expect(periodRange('2026-02')).toEqual({ date_from: '2026-02-01', date_to: '2026-02-28' })
  })
  it('convierte cuadrículas y detecta celdas inválidas', () => {
    expect(toNumberGrid([[1, '2'], ['3', 4]])).toEqual([[1, 2], [3, 4]])
    expect(toNumberGrid([[1, ''], ['x', 4]])).toBeNull()
  })
  it('construye operandos manuales y detecta errores', () => {
    expect(toOperand('matrix', { mode: 'manual', text: '1 2\n3 4' })).toEqual({ kind: 'matrix', values: [[1, 2], [3, 4]] })
    expect(toOperand('vector', { mode: 'manual', text: '1, a' })).toMatch(/no numéricos/)
    expect(toOperand('vector', { mode: 'saved', text: '' })).toMatch(/Seleccione/)
  })
})

describe('validación de formularios (Zod)', () => {
  it('rechaza costo mayor que precio', () => {
    const r = productSchema.safeParse({ sku: 'X', name: 'Prod', category_id: '', unit_price: 10, unit_cost: 20, is_active: true })
    expect(r.success).toBe(false)
  })
  it('valida el RUC de 11 dígitos', () => {
    expect(companySchema.safeParse({ name: 'Emp', ruc: '123', currency: 'PEN' }).success).toBe(false)
    expect(companySchema.safeParse({ name: 'Emp', ruc: '20601234571', currency: 'PEN' }).success).toBe(true)
  })
})

describe('componentes de matrices', () => {
  it('muestra etiquetas y valores', () => {
    render(<MatrixView values={[[1, -2]]} rowLabels={['Lima']} colLabels={['Laptop', 'PC']} />)
    expect(screen.getByText('Lima')).toBeInTheDocument()
    expect(screen.getByText('Laptop')).toBeInTheDocument()
    expect(screen.getByText('-2')).toHaveClass('text-red-600')
  })
  it('permite agregar columnas en el editor', () => {
    const onChange = vi.fn()
    render(<MatrixEditor values={[[1, 2]]} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Agregar Columnas'))
    expect(onChange).toHaveBeenCalledWith([[1, 2, 0]])
  })
})

function renderLogin() {
  const qc = new QueryClient()
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('login', () => {
  it('inicia el escaneo facial al completar los 8 dígitos del DNI', async () => {
    renderLogin()
    const dni = screen.getByLabelText('DNI')
    fireEvent.change(dni, { target: { value: '7000a0001' } })
    expect(dni).toHaveValue('70000001')
    await waitFor(() => expect(screen.getByText('Cambiar DNI')).toBeInTheDocument())
    // jsdom no tiene cámara: el escáner muestra un mensaje claro
    await waitFor(() => expect(screen.getByText(/no permite usar la cámara/)).toBeInTheDocument())
  })

  it('valida el formulario de contraseña antes de enviar', async () => {
    renderLogin()
    fireEvent.click(screen.getByRole('tab', { name: /Correo y contraseña/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    await waitFor(() => expect(screen.getByText('Ingrese un correo válido')).toBeInTheDocument())
    expect(screen.getByText('Ingrese su contraseña')).toBeInTheDocument()
  })
})

describe('pestañas por módulo', () => {
  function Demo() {
    const [tab, setTab] = useTab(['a', 'b'] as const, 'a')
    const loc = useLocation()
    return (
      <>
        <ModuleTabs value={tab} onChange={setTab} items={[{ value: 'a', label: 'Uno' }, { value: 'b', label: 'Dos' }]} />
        {tab === 'a' ? <p>contenido A</p> : <p>contenido B</p>}
        <span data-testid="url">{loc.search}</span>
      </>
    )
  }
  it('monta solo la pestaña activa y la guarda en la URL', () => {
    render(<MemoryRouter><Demo /></MemoryRouter>)
    expect(screen.getByText('contenido A')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Dos' }))
    expect(screen.queryByText('contenido A')).not.toBeInTheDocument()
    expect(screen.getByText('contenido B')).toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('?tab=b')
  })
})

describe('biometría', () => {
  it('calcula el EAR para detectar parpadeo', () => {
    const open = [{ x: 0, y: 0 }, { x: 1, y: -0.3 }, { x: 2, y: -0.3 }, { x: 3, y: 0 }, { x: 2, y: 0.3 }, { x: 1, y: 0.3 }]
    const closed = open.map((p) => ({ x: p.x, y: p.y * 0.2 }))
    expect(eyeAspectRatio(open)).toBeCloseTo(0.2, 1)
    expect(eyeAspectRatio(closed)).toBeLessThan(eyeAspectRatio(open))
  })
  it('promedia descriptores', () => {
    expect(meanDescriptor([[1, 2], [3, 4]])).toEqual([2, 3])
  })
})
