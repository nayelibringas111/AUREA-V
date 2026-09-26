export interface GeoPoint {
  latitude: number
  longitude: number
  accuracy?: number
}

/**
 * Pide la ubicación del dispositivo (el navegador muestra el aviso de permiso).
 * Nunca falla: si el usuario no la comparte, devuelve null y el backend estima la zona por IP.
 */
export function getBrowserLocation(timeoutMs = 7000): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
    const timer = setTimeout(() => resolve(null), timeoutMs + 500)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer)
        resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) })
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    )
  })
}
