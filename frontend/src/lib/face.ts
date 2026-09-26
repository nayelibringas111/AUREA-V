/**
 * Reconocimiento facial en el navegador con face-api (TensorFlow.js).
 * - Los modelos se sirven desde /models (mismo dominio, sin CDN externo).
 * - Del rostro se obtiene un descriptor de 128 números; solo ese vector viaja al backend,
 *   que lo compara con NumPy (distancia euclidiana). No se envían imágenes del escaneo.
 */
type FaceApi = typeof import('@vladmandic/face-api')

let loading: Promise<FaceApi> | null = null

export function loadFaceApi(): Promise<FaceApi> {
  if (!loading) {
    loading = (async () => {
      const f = await import('@vladmandic/face-api')
      const tf = f.tf as unknown as { setBackend(b: string): Promise<boolean>; ready(): Promise<void> }
      try {
        if (!(await tf.setBackend('webgl'))) await tf.setBackend('cpu')
      } catch {
        await tf.setBackend('cpu')
      }
      await tf.ready()
      const url = `${import.meta.env.BASE_URL}models`
      await Promise.all([
        f.nets.tinyFaceDetector.loadFromUri(url),
        f.nets.faceLandmark68Net.loadFromUri(url),
        f.nets.faceRecognitionNet.loadFromUri(url),
      ])
      return f
    })().catch((e) => {
      loading = null
      throw e
    })
  }
  return loading
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Lighting {
  mean: number // 0–255
  contrast: number // desviación estándar
  backlight: boolean // rostro mucho más oscuro que el fondo
  status: 'ok' | 'dark' | 'bright' | 'flat' | 'backlight'
  message: string
}

const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null

/** Mide la iluminación de la imagen (luminancia media, contraste y contraluz). */
export function measureLighting(video: HTMLVideoElement, face?: Box | null): Lighting {
  const w = 96
  const h = Math.round((video.videoHeight / video.videoWidth) * w) || 72
  canvas!.width = w
  canvas!.height = h
  const ctx = canvas!.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(video, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const sx = w / video.videoWidth
  const sy = h / video.videoHeight
  let sum = 0
  let sum2 = 0
  let fSum = 0
  let fN = 0
  let bSum = 0
  let bN = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      sum += l
      sum2 += l * l
      const inFace = face
        ? x >= face.x * sx && x <= (face.x + face.width) * sx && y >= face.y * sy && y <= (face.y + face.height) * sy
        : Math.abs(x - w / 2) < w * 0.18 && Math.abs(y - h / 2) < h * 0.25
      if (inFace) {
        fSum += l
        fN++
      } else {
        bSum += l
        bN++
      }
    }
  }
  const n = w * h
  const mean = sum / n
  const contrast = Math.sqrt(Math.max(0, sum2 / n - mean * mean))
  const faceMean = fN ? fSum / fN : mean
  const bgMean = bN ? bSum / bN : mean
  const backlight = bgMean - faceMean > 45 && faceMean < 110
  let status: Lighting['status'] = 'ok'
  let message = 'Iluminación adecuada'
  if (mean < 60 || faceMean < 55) {
    status = 'dark'
    message = 'Poca luz: ubíquese frente a una ventana o encienda una luz frontal.'
  } else if (mean > 215 || faceMean > 225) {
    status = 'bright'
    message = 'Demasiada luz: evite la luz directa sobre la cámara.'
  } else if (backlight) {
    status = 'backlight'
    message = 'Contraluz: evite tener una ventana o lámpara detrás de usted.'
  } else if (contrast < 18) {
    status = 'flat'
    message = 'Imagen sin contraste: limpie la cámara o mejore la luz.'
  }
  return { mean, contrast, backlight, status, message }
}

type Pt = { x: number; y: number }
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** Eye Aspect Ratio: ≈0.3 con el ojo abierto y <0.2 al parpadear. */
export function eyeAspectRatio(eye: Pt[]): number {
  return (dist(eye[1], eye[5]) + dist(eye[2], eye[4])) / (2 * dist(eye[0], eye[3]))
}

const center = (pts: Pt[]) => ({ x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length })

/** Giro horizontal aproximado: desplazamiento de la nariz respecto al centro de los ojos (≈0 de frente). */
export function yawRatio(positions: Pt[]): number {
  const le = center(positions.slice(36, 42))
  const re = center(positions.slice(42, 48))
  const nose = positions[30]
  return (nose.x - (le.x + re.x) / 2) / (dist(le, re) || 1)
}

/**
 * Prueba de vida adaptativa. Se acepta si ocurre cualquiera de estas dos señales:
 *  - Parpadeo: el EAR cae ≥ 18 % por debajo de la línea base de la persona y luego se recupera.
 *  - Giro de cabeza: desde una posición frontal, la cabeza gira levemente (|yaw| > 0.12) y vuelve.
 * (El modelo de 68 puntos marca poco los ojos cerrados, por eso la línea base es propia de cada usuario.)
 */
export class LivenessDetector {
  private ears: number[] = []
  private eyesDown = false
  private sawFrontal = false
  private turned = false
  passed: 'blink' | 'turn' | null = null

  update(ear: number, yaw: number): 'blink' | 'turn' | null {
    if (this.passed) return this.passed
    // --- parpadeo relativo
    const baseline = this.ears.length >= 5 ? [...this.ears].sort((a, b) => a - b)[Math.floor(this.ears.length * 0.75)] : null
    if (baseline) {
      if (ear < baseline * 0.82) this.eyesDown = true
      else if (this.eyesDown && ear > baseline * 0.93) this.passed = 'blink'
    }
    if (!this.eyesDown) {
      this.ears.push(ear)
      if (this.ears.length > 20) this.ears.shift()
    }
    // --- giro de cabeza
    const a = Math.abs(yaw)
    if (a < 0.06) {
      if (this.turned && this.sawFrontal) this.passed = 'turn'
      this.sawFrontal = true
    } else if (a > 0.12 && this.sawFrontal) this.turned = true
    return this.passed
  }
}

/** Promedio componente a componente de varios descriptores (vector más estable). */
export function meanDescriptor(ds: Float32Array[] | number[][]): number[] {
  const n = ds.length
  const out = new Array(ds[0].length).fill(0)
  for (const d of ds) for (let i = 0; i < out.length; i++) out[i] += d[i] / n
  return out
}

export function euclidean(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2
  return Math.sqrt(s)
}

/** Recorta el rostro para la foto del carnet (miniatura JPEG 160×200). */
export function captureFacePhoto(video: HTMLVideoElement, box: Box): string {
  const c = document.createElement('canvas')
  c.width = 160
  c.height = 200
  const ctx = c.getContext('2d')!
  const padX = box.width * 0.35
  const padY = box.height * 0.5
  const sx = Math.max(0, box.x - padX)
  const sy = Math.max(0, box.y - padY)
  const sw = Math.min(video.videoWidth - sx, box.width + padX * 2)
  const sh = Math.min(video.videoHeight - sy, sw * 1.25)
  ctx.translate(160, 0)
  ctx.scale(-1, 1) // espejo, igual que la vista previa
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 160, 200)
  return c.toDataURL('image/jpeg', 0.82)
}
