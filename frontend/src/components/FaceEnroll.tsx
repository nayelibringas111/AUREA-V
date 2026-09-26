import { useMutation } from '@tanstack/react-query'
import { ScanFace, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { FaceScanner, type ScanResult } from '@/components/FaceScanner'
import { Button, ErrorBox } from '@/components/ui'
import { errorMessage } from '@/services/api'
import type { FaceEnrollBody } from '@/services/endpoints'
import type { User } from '@/types'

/** Registro biométrico: consentimiento → escaneo (5 muestras + parpadeo) → envío de descriptores. */
export function FaceEnroll({ submit, onDone, subject }: { submit: (b: FaceEnrollBody) => Promise<User>; onDone: (u: User) => void; subject?: string }) {
  const [consent, setConsent] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (r: ScanResult) => submit({ descriptors: r.descriptors, photo: r.photo, consent: true, brightness: r.brightness }),
    onSuccess: (u) => {
      toast.success('Rostro registrado correctamente')
      onDone(u)
    },
    onError: () => setScanning(false),
  })

  if (scanning) {
    return (
      <div className="space-y-3">
        <FaceScanner
          mode="enroll"
          title={subject ? `Escaneo de ${subject}` : undefined}
          onCancel={() => setScanning(false)}
          onComplete={(r) => {
            setPreview(r.photo)
            save.mutate(r)
          }}
        />
        {save.isPending && <p className="text-center text-sm text-muted">Guardando biometría…</p>}
        {preview && save.isPending && <img src={preview} alt="" className="mx-auto h-24 rounded-lg" />}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {save.error && <ErrorBox message={errorMessage(save.error)} />}
      <div className="rounded-lg border border-line bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink"><ShieldCheck className="size-3.5" /> Tratamiento de datos biométricos</p>
        Se tomarán 5 capturas del rostro para calcular un <b>vector descriptor de 128 números</b>. Solo se guarda ese vector y una
        miniatura para el carnet; <b>no se almacena video ni las imágenes del escaneo</b>. Los datos se usan únicamente para verificar la
        identidad al iniciar sesión (Ley N.º 29733 de Protección de Datos Personales) y puede eliminarlos en cualquier momento.
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
        {subject ? `${subject} otorga` : 'Otorgo'} mi consentimiento para el registro y uso de mis datos biométricos.
      </label>
      <Button disabled={!consent} icon={<ScanFace className="size-4" />} onClick={() => setScanning(true)}>Iniciar escaneo facial</Button>
    </div>
  )
}
