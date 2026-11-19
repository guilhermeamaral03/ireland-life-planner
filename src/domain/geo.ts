export interface LatLng {
  lat: number
  lng: number
}

/** Raio médio da Terra (IUGG), em km. */
const EARTH_RADIUS_KM = 6371.0088
const rad = (deg: number) => (deg * Math.PI) / 180

/** Distância em linha reta (grande círculo) — não é distância rodoviária. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export function validCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}
