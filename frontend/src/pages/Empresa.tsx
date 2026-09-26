import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Save } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button, Card, ErrorBox, Field, Input, PageHeader, Spinner, StatCard } from '@/components/ui'
import { companySchema, type CompanyForm } from '@/schemas'
import { errorMessage } from '@/services/api'
import { branchApi, companyApi, productApi } from '@/services/endpoints'
import type { Company } from '@/types'

export default function Empresa() {
  const qc = useQueryClient()
  const company = useQuery({ queryKey: ['company'], queryFn: companyApi.current })
  const branches = useQuery({ queryKey: ['branches'], queryFn: branchApi.list })
  const products = useQuery({ queryKey: ['products'], queryFn: productApi.list })
  const form = useForm<CompanyForm>({ resolver: zodResolver(companySchema) })

  useEffect(() => {
    if (company.data) {
      const c = company.data
      form.reset({ ...c, legal_name: c.legal_name ?? '', ruc: c.ruc ?? '', sector: c.sector ?? '', address: c.address ?? '', phone: c.phone ?? '', email: c.email ?? '' })
    }
  }, [company.data, form])

  const save = useMutation({
    mutationFn: (d: Partial<Company>) => companyApi.update(d),
    onSuccess: (c) => {
      qc.setQueryData(['company'], c)
      toast.success('Datos de la empresa actualizados')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (company.isLoading) return <Spinner />
  if (company.error) return <ErrorBox message={errorMessage(company.error)} />
  const e = form.formState.errors

  return (
    <>
      <PageHeader title="Empresa" description="Información corporativa y configuración general del negocio." />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Sucursales activas" value={branches.data?.filter((b) => b.is_active).length ?? '—'} icon={<Building2 className="size-4" />} />
        <StatCard label="Productos activos" value={products.data?.filter((p) => p.is_active).length ?? '—'} tone="accent" />
        <StatCard label="Moneda" value={company.data?.currency} tone="green" />
      </div>
      <Card title="Datos corporativos">
        <form onSubmit={form.handleSubmit((d) => save.mutate(companySchema.parse(d) as Partial<Company>))} className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre comercial" error={e.name?.message}>
            <Input {...form.register('name')} />
          </Field>
          <Field label="Razón social" error={e.legal_name?.message}>
            <Input {...form.register('legal_name')} />
          </Field>
          <Field label="RUC" error={e.ruc?.message}>
            <Input {...form.register('ruc')} maxLength={11} />
          </Field>
          <Field label="Sector" error={e.sector?.message}>
            <Input {...form.register('sector')} />
          </Field>
          <Field label="Dirección fiscal" error={e.address?.message} className="md:col-span-2">
            <Input {...form.register('address')} />
          </Field>
          <Field label="Teléfono" error={e.phone?.message}>
            <Input {...form.register('phone')} />
          </Field>
          <Field label="Correo" error={e.email?.message}>
            <Input {...form.register('email')} />
          </Field>
          <Field label="Moneda (ISO)" error={e.currency?.message}>
            <Input {...form.register('currency')} maxLength={3} />
          </Field>
          <div className="flex items-end justify-end md:col-span-2">
            <Button type="submit" loading={save.isPending} icon={<Save className="size-4" />}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
