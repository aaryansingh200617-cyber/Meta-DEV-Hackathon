import type { AssistPoint, LatLng, LatLngTuple, Observation, ObsValue, Place, RouteOption, TravelMode } from '../types';
import { haversine, offsetM, pointAlong, polylineLength } from '../geo';
import { hashString, rng } from './rng';
import { buildEvidence, SEGMENTS } from './evidence';

interface Profile {
  id: 'A' | 'B' | 'C';
  label: string;
  summary: string;
  bend: number;
  wiggle: number;
  speed: Record<TravelMode, number>; // m/s
  // Probability an evidence segment is fresh / aging / outdated (remainder = missing)
  pFresh: number; pAging: number; pOutdated: number;
  pPoorLight: number;
  assist: number;
}

const PROFILES: Profile[] = [
  { id: 'A', label: 'Route A · Main arterial', summary: 'Largest roads, fewest turns', bend: 0.05, wiggle: 0, speed: { walk: 1.35, drive: 6.2, transit: 4.4 }, pFresh: 0.38, pAging: 0.2, pOutdated: 0.14, pPoorLight: 0.12, assist: 7 },
  { id: 'B', label: 'Route B · Mixed roads', summary: 'Mix of main and secondary roads', bend: -0.13, wiggle: 0.006, speed: { walk: 1.32, drive: 5.4, transit: 4.0 }, pFresh: 0.55, pAging: 0.22, pOutdated: 0.08, pPoorLight: 0.2, assist: 5 },
  { id: 'C', label: 'Route C · Inner streets', summary: 'Shorter cut through residential streets', bend: 0.2, wiggle: 0.014, speed: { walk: 1.28, drive: 4.7, transit: 3.8 }, pFresh: 0.22, pAging: 0.18, pOutdated: 0.3, pPoorLight: 0.38, assist: 3 },
];

function curve(a: LatLng, b: LatLng, bend: number, wiggle: number, rand: () => number): LatLngTuple[] {
  const d = haversine(a, b);
  const midLat = (a.lat + b.lat) / 2;
  const midLng = (a.lng + b.lng) / 2;
  // unit perpendicular in local metres
  const dx = (b.lng - a.lng) * Math.cos((midLat * Math.PI) / 180);
  const dy = b.lat - a.lat;
  const n = Math.hypot(dx, dy) || 1;
  const px = -dy / n;
  const py = dx / n;
  const ctrl = offsetM({ lat: midLat, lng: midLng }, px * bend * d * 2, py * bend * d * 2);
  const phase = rand() * Math.PI * 2;
  const N = 48;
  const out: LatLngTuple[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let lat = (1 - t) ** 2 * a.lat + 2 * (1 - t) * t * ctrl.lat + t ** 2 * b.lat;
    let lng = (1 - t) ** 2 * a.lng + 2 * (1 - t) * t * ctrl.lng + t ** 2 * b.lng;
    if (wiggle && i > 0 && i < N) {
      // Street-grid style zig-zag: alternate east/north offsets
      const w = Math.sin(t * Math.PI * 7 + phase) * wiggle * d;
      const q = offsetM({ lat, lng }, px * w, py * w);
      lat = q.lat; lng = q.lng;
    }
    out.push([lat, lng]);
  }
  return out;
}

const ASSIST_KINDS: { kind: AssistPoint['kind']; name: string }[] = [
  { kind: 'police', name: 'Police station' },
  { kind: 'hospital', name: 'Hospital / clinic' },
  { kind: 'pharmacy', name: '24h pharmacy' },
  { kind: 'open_late', name: 'Late-night shop' },
  { kind: 'transit', name: 'Metro / bus stop' },
];

/** Three deterministic, clearly simulated alternatives for any origin/destination pair. */
export function demoRoutes(origin: Place, destination: Place, mode: TravelMode, now = Date.now()): RouteOption[] {
  return PROFILES.map((p) => {
    const rand = rng(hashString(`${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}>${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}:${p.id}`));
    const polyline = curve(origin, destination, p.bend, p.wiggle, rand);
    const dist = polylineLength(polyline);
    const duration = dist / p.speed[mode];
    const total = dist;
    const segLen = total / SEGMENTS;

    // Simulated observations along the route
    const observations: Observation[] = [];
    for (let s = 0; s < SEGMENTS; s++) {
      const r = rand();
      let ageDays: number | null;
      if (r < p.pFresh) ageDays = 1 + Math.floor(rand() * 27);
      else if (r < p.pFresh + p.pAging) ageDays = 35 + Math.floor(rand() * 50);
      else if (r < p.pFresh + p.pAging + p.pOutdated) ageDays = 100 + Math.floor(rand() * 260);
      else ageDays = null;
      if (ageDays === null) continue;
      const center = pointAlong(polyline, (s + 0.5) * segLen);
      const jitter = offsetM(center, (rand() - 0.5) * 30, (rand() - 0.5) * 30);
      const observedAt = new Date(now - ageDays * 86400_000 - rand() * 6 * 3600_000).toISOString();
      const lv: ObsValue = rand() < p.pPoorLight ? 'poor' : rand() < 0.5 ? 'good' : 'moderate';
      observations.push({ id: `${p.id}-L${s}`, kind: 'lighting', value: lv, lat: jitter.lat, lng: jitter.lng, observedAt, source: 'demo', note: 'Simulated demonstration observation' });
      if (rand() < 0.75) {
        const vv: ObsValue = rand() < p.pPoorLight * 0.8 ? 'poor' : rand() < 0.55 ? 'good' : 'moderate';
        observations.push({ id: `${p.id}-V${s}`, kind: 'visibility', value: vv, lat: jitter.lat, lng: jitter.lng, observedAt, source: 'demo', note: 'Simulated demonstration observation' });
      }
    }

    // Simulated assistance points (some deliberately beyond the counting radius)
    const assist: AssistPoint[] = [];
    for (let k = 0; k < p.assist + 2; k++) {
      const along = (0.05 + rand() * 0.9) * total;
      const c = pointAlong(polyline, along);
      const far = k >= p.assist;
      const off = far ? 320 + rand() * 250 : 30 + rand() * 190;
      const ang = rand() * Math.PI * 2;
      const q = offsetM(c, Math.cos(ang) * off, Math.sin(ang) * off);
      const kind = ASSIST_KINDS[Math.floor(rand() * ASSIST_KINDS.length)]!;
      assist.push({ id: `${p.id}-A${k}`, kind: kind.kind, name: `${kind.name} (simulated)`, lat: q.lat, lng: q.lng, openNow: kind.kind === 'open_late' ? rand() < 0.6 : null, source: 'demo' });
    }

    return {
      id: `demo-${p.id}`,
      label: p.label,
      summary: p.summary,
      distanceM: Math.round(dist),
      durationS: Math.round(duration),
      polyline,
      source: 'demo' as const,
      simulated: true,
      evidence: buildEvidence(polyline, observations, assist, { sources: ['demo'], simulated: true }, now),
    };
  });
}
