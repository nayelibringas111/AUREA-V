import { useQuery } from '@tanstack/react-query'
import { RefreshCw, ScanFace } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Carnet } from '@/components/Carnet'
import { Button, ErrorBox, PageHeader, Spinner } from '@/components/ui'
import { errorMessage } from '@/services/api'
import { authApi } from '@/services/endpoints'

export default function CarnetPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['carnet'], queryFn: authApi.carnet })
  return (
    <>
      <PageHeader
        title="Mi carnet"
        description="Identificación con datos de auditoría: actividad de los últimos 7 días, usuarios más activos y ubicación de su acceso actual."
        actions={<Button variant="secondary" icon={<RefreshCw className="size-4" />} loading={isFetching} onClick={() => refetch()}>Actualizar</Button>}
      />
      {isLoading && <Spinner />}
      {error && <ErrorBox message={errorMessage(error)} />}
      {data && !data.user.face_enrolled && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex items-center gap-2"><ScanFace className="size-4" /> Registre su rostro para ingresar con DNI y para que su foto aparezca en el carnet.</span>
          <Link to="/configuracion?tab=rostro" className="font-medium text-primary hover:underline">Registrar rostro →</Link>
        </div>
      )}
      {data && <Carnet data={data} />}
    </>
  )
}
