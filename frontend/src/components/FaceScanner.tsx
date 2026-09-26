import { AlertTriangle, Camera, CheckCircle2, Circle, Eye, Loader2, Sun, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { captureFacePhoto, euclidean, eyeAspectRatio, LivenessDetector, loadFaceApi, measureLighting, meanDescriptor, yawRatio, type Box, type Lighting } from '@/lib/face'
import { cn } from '@/lib/utils'

export interface ScanResult {
  descriptor: number[] // promedio (login)
  descriptors: number[][] // muestras individuales (registro)
  photo: string | null
  brightness: number
  liveness: boolean
}

interface Checks {
  lighting: boolean
  face: boolean
  centered: boolean
  blink: boolean
}

const TIMEOUT_MS = 45_000

export function FaceScanner({
  mode,
  onComplete,
  onCancel,
  title,
}: {
  mode: 'login' | 'enroll'
  onComplete: (r: ScanResult) => void
  onCancel?: () => void
  title?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<'loading' | 'scanning' | 'done' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [lighting, setLighting] = useState<Lighting | null>(null)
  const [checks, setChecks] = useState<Checks>({ lighting: false, face: false, centered: false, blink: false })
  const [hint, setHint] = useState('Preparando cámara…')
  const [progress, setProgress] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [attempt, setAttempt] = useState(0)
  const needed = mode === 'enroll' ? 5 : 3

  useEffect(() => {
    let stream: MediaStream | null = null
    let running = true
    const samples: Float32Array[] = []
    let lastSampleAt = 0
    let photo: string | null = null
    let blinked = false
    const liveness = new LivenessDetector()
    let lastYaw = 0
    const brightness: number[] = []
    const started = Date.now()

    const stop = () => {
      running = false
      stream?.getTracks().forEach((t) => t.stop())
    }

    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara (se requiere HTTPS).')
        const [f, s] = await Promise.all([
          loadFaceApi(),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
        ])
        stream = s
        if (!running) return stop()
        const video = videoRef.current!
        video.srcObject = s
        await video.play()
        setPhase('scanning')
        const options = new f.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })

        const loop = async () => {
          if (!running) return
          if (Date.now() - started > TIMEOUT_MS) {
            setPhase('error')
            setError('No se pudo completar el escaneo a tiempo. Revise la iluminación y vuelva a intentarlo.')
            return stop()
          }
          const results = await f.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors()
          if (!running) return
          const vw = video.videoWidth
          const vh = video.videoHeight
          const main = results.sort((a, b) => b.detection.box.area - a.detection.box.area)[0]
          const b = main?.detection.box
          const light = measureLighting(video, b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null)
          setLighting(light)
          setBox(b ? { x: b.x / vw, y: b.y / vh, width: b.width / vw, height: b.height / vh } : null)

          const c: Checks = { lighting: light.status === 'ok', face: false, centered: false, blink: blinked }
          let msg = light.status === 'ok' ? '' : light.message
          if (results.length > 1) msg = 'Se detecta más de un rostro: debe haber una sola persona frente a la cámara.'
          else if (!main) msg = msg || 'Ubique su rostro dentro del óvalo.'
          else {
            c.face = main.detection.score > 0.6
            const rel = b!.width / vw
            const cx = (b!.x + b!.width / 2) / vw
            const cy = (b!.y + b!.height / 2) / vh
            c.centered = rel > 0.22 && rel < 0.75 && Math.abs(cx - 0.5) < 0.15 && Math.abs(cy - 0.5) < 0.2
            if (!msg && rel <= 0.22) msg = 'Acérquese un poco a la cámara.'
            else if (!msg && rel >= 0.75) msg = 'Aléjese un poco de la cámara.'
            else if (!msg && !c.centered) msg = 'Centre su rostro en el óvalo.'

            // Prueba de vida: parpadeo o leve giro de cabeza (ver LivenessDetector)
            const ear = (eyeAspectRatio(main.landmarks.getLeftEye()) + eyeAspectRatio(main.landmarks.getRightEye())) / 2
            const yaw = yawRatio(main.landmarks.positions)
            lastYaw = yaw
            if (c.face) blinked = !!liveness.update(ear, yaw)
            c.blink = blinked

            // Las muestras del descriptor se toman con el rostro de frente
            const good = c.lighting && c.face && c.centered && results.length === 1 && Math.abs(yaw) < 0.08
            const spacing = mode === 'enroll' ? 350 : 120
            if (good && Date.now() - lastSampleAt > spacing && samples.length < needed) {
              const d = main.descriptor
              if (samples.length === 0 || euclidean(d, samples[0]) < 0.45) {
                samples.push(d)
                brightness.push(light.mean)
                lastSampleAt = Date.now()
                if (!photo && mode === 'enroll') photo = captureFacePhoto(video, b!)
              }
            }
            if (!msg && samples.length >= needed && !blinked) msg = 'Parpadee o gire levemente la cabeza y vuelva al frente.'
            if (!msg && samples.length < needed) msg = Math.abs(lastYaw) >= 0.08 ? 'Mire de frente a la cámara.' : 'Mantenga la mirada en la cámara…'
          }
          setChecks(c)
          setHint(msg)
          setProgress(Math.round((Math.min(samples.length, needed) / needed) * (blinked ? 100 : 85)))

          if (samples.length >= needed && blinked) {
            setPhase('done')
            setHint('Escaneo completado')
            stop()
            onComplete({
              descriptor: meanDescriptor(samples),
              descriptors: samples.map((s) => Array.from(s)),
              photo,
              brightness: Math.round(brightness.reduce((a, x) => a + x, 0) / brightness.length),
              liveness: true,
            })
            return
          }
          setTimeout(loop, 60)
        }
        loop()
      } catch (e) {
        const err = e as Error & { name?: string }
        setPhase('error')
        setError(
          err.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Habilítelo en el candado de la barra de direcciones.'
            : err.name === 'NotFoundError'
              ? 'No se encontró una cámara en este dispositivo.'
              : err.message || 'No se pudo iniciar la cámara.',
        )
        stop()
      }
    })()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  const items: { key: keyof Checks; label: string; icon: JSX.Element }[] = [
    { key: 'lighting', label: 'Iluminación', icon: <Sun className="size-3.5" /> },
    { key: 'face', label: 'Rostro detectado', icon: <UserRound className="size-3.5" /> },
    { key: 'centered', label: 'Centrado y distancia', icon: <Camera className="size-3.5" /> },
    { key: 'blink', label: 'Prueba de vida', icon: <Eye className="size-3.5" /> },
  ]
  const lightPct = lighting ? Math.min(100, (lighting.mean / 255) * 100) : 0

  return (
    <div className="space-y-4">
      {title && <p className="text-sm font-medium">{title}</p>}
      <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl bg-slate-900">
        <video ref={videoRef} playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
        {/* Guía ovalada */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              'h-[72%] w-[46%] rounded-[50%] border-4 transition-colors',
              phase === 'done' ? 'border-emerald-400' : checks.face && checks.centered && checks.lighting ? 'border-accent' : 'border-white/60',
            )}
            style={{ boxShadow: '0 0 0 9999px rgba(15,23,42,0.45)' }}
          />
        </div>
        {box && phase === 'scanning' && (
          <div
            className="pointer-events-none absolute rounded-md border border-cyan-300/70"
            style={{ left: `${(1 - box.x - box.width) * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}
          />
        )}
        {phase === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white">
            <Loader2 className="size-6 animate-spin" /> Cargando modelos y cámara…
          </div>
        )}
        {phase === 'done' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-900/40 text-sm font-medium text-white">
            <CheckCircle2 className="size-10 text-emerald-300" /> Escaneo completado
          </div>
        )}
        {phase === 'scanning' && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent px-4 pb-3 pt-8 text-center text-sm text-white">
            {hint || 'Escaneando…'}
          </div>
        )}
      </div>

      {phase === 'error' ? (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { setError(null); setPhase('loading'); setProgress(0); setAttempt((a) => a + 1) }}>Reintentar</Button>
            {onCancel && <Button size="sm" variant="secondary" onClick={onCancel}>Cancelar</Button>}
          </div>
        </div>
      ) : (
        <>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {items.map((it) => (
              <div key={it.key} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs', checks[it.key] ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-line text-muted')}>
                {checks[it.key] ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                {it.icon}
                {it.label}
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-muted">
              <span className="flex items-center gap-1"><Sun className="size-3" /> Nivel de luz</span>
              <span className={lighting?.status === 'ok' ? 'text-emerald-700' : 'text-amber-700'}>{lighting ? lighting.message : '—'}</span>
            </div>
            <div className="relative h-2 rounded-full bg-gradient-to-r from-slate-800 via-amber-200 to-white ring-1 ring-line">
              <div className="absolute inset-y-0 left-[24%] right-[16%] rounded-full ring-2 ring-emerald-500/60" title="Rango adecuado" />
              {lighting && <div className="absolute -top-1 h-4 w-1 rounded bg-primary" style={{ left: `calc(${lightPct}% - 2px)` }} />}
            </div>
          </div>
          {onCancel && phase !== 'done' && (
            <div className="text-right">
              <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={onCancel}>Cancelar</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
