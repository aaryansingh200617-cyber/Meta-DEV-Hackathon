import type { LatLng, LatLngTuple } from './types';

const R = 6371008.8; // mean Earth radius (m)
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export const toLL = (t: LatLngTuple): LatLng => ({ lat: t[0], lng: t[1] });

export function polylineLength(pl: LatLngTuple[]): number {
  let d = 0;
  for (let i = 1; i < pl.length; i++) d += haversine(toLL(pl[i - 1]!), toLL(pl[i]!));
  return d;
}

/** Local equirectangular projection around a reference latitude: metres. Accurate enough at city scale. */
function proj(p: LatLng, ref: number) {
  return { x: rad(p.lng) * R * Math.cos(rad(ref)), y: rad(p.lat) * R };
}

export interface RouteProjection { distanceM: number; alongM: number; point: LatLng }

/** Nearest point on a polyline: perpendicular distance and distance travelled along the line. */
export function projectOnPolyline(p: LatLng, pl: LatLngTuple[]): RouteProjection {
  let best: RouteProjection = { distanceM: Infinity, alongM: 0, point: toLL(pl[0]!) };
  let acc = 0;
  const ref = p.lat;
  const P = proj(p, ref);
  for (let i = 1; i < pl.length; i++) {
    const A = toLL(pl[i - 1]!);
    const B = toLL(pl[i]!);
    const a = proj(A, ref);
    const b = proj(B, ref);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((P.x - a.x) * dx + (P.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const dist = Math.hypot(P.x - cx, P.y - cy);
    const segLen = Math.sqrt(len2);
    if (dist < best.distanceM) {
      best = { distanceM: dist, alongM: acc + t * segLen, point: { lat: A.lat + (B.lat - A.lat) * t, lng: A.lng + (B.lng - A.lng) * t } };
    }
    acc += segLen;
  }
  return best;
}

/** Point at a given distance along the polyline. */
export function pointAlong(pl: LatLngTuple[], distM: number): LatLng {
  let acc = 0;
  for (let i = 1; i < pl.length; i++) {
    const A = toLL(pl[i - 1]!);
    const B = toLL(pl[i]!);
    const seg = haversine(A, B);
    if (acc + seg >= distM || i === pl.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, Math.max(0, (distM - acc) / seg));
      return { lat: A.lat + (B.lat - A.lat) * t, lng: A.lng + (B.lng - A.lng) * t };
    }
    acc += seg;
  }
  return toLL(pl[pl.length - 1]!);
}

/** Offset a point by metres east/north. */
export function offsetM(p: LatLng, eastM: number, northM: number): LatLng {
  return { lat: p.lat + (northM / R) * (180 / Math.PI), lng: p.lng + (eastM / (R * Math.cos(rad(p.lat)))) * (180 / Math.PI) };
}

export function boundsOf(points: LatLng[]) {
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, minLng, maxLat, maxLng };
}

/** Decode a Google encoded polyline (precision 5). */
export function decodePolyline(str: string): LatLngTuple[] {
  let index = 0, lat = 0, lng = 0;
  const out: LatLngTuple[] = [];
  while (index < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta; else lng += delta;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

/** Thin a polyline so very long Google routes stay small when stored/sent. */
export function simplify(pl: LatLngTuple[], maxPoints = 400): LatLngTuple[] {
  if (pl.length <= maxPoints) return pl;
  const step = (pl.length - 1) / (maxPoints - 1);
  const out: LatLngTuple[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(pl[Math.round(i * step)]!);
  return out;
}
