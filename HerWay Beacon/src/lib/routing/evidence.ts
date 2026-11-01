import type { AssistPoint, EvidenceSegment, LatLng, LatLngTuple, ObsValue, Observation, RouteEvidence, SegmentStatus } from '../types';
import { ASSIST_RADIUS_M, FRESH_DAYS, OUTDATED_DAYS } from '../defaults';
import { polylineLength, projectOnPolyline } from '../geo';

export const SEGMENTS = 24;
/** An observation only counts for a route if it was made within this distance of the line. */
export const OBS_MAX_OFFSET_M = 60;

const DAY = 86400_000;

function status(ageDays: number | null): SegmentStatus {
  if (ageDays === null) return 'missing';
  if (ageDays <= FRESH_DAYS) return 'fresh';
  if (ageDays <= OUTDATED_DAYS) return 'aging';
  return 'outdated';
}

/**
 * Turns raw observations + assistance points into a per-route evidence ledger.
 * It deliberately produces NO safety score — only what was observed, when, and what is missing.
 */
export function buildEvidence(
  polyline: LatLngTuple[],
  observations: Observation[],
  assistCandidates: AssistPoint[],
  opts: { sources: RouteEvidence['sources']; simulated: boolean },
  now = Date.now(),
): RouteEvidence {
  const total = polylineLength(polyline) || 1;
  const segLen = total / SEGMENTS;

  const perSeg: Observation[][] = Array.from({ length: SEGMENTS }, () => []);
  const used: Observation[] = [];
  for (const o of observations) {
    const pr = projectOnPolyline(o, polyline);
    if (pr.distanceM > OBS_MAX_OFFSET_M) continue;
    const idx = Math.min(SEGMENTS - 1, Math.floor(pr.alongM / segLen));
    perSeg[idx]!.push(o);
    used.push(o);
  }

  const segments: EvidenceSegment[] = perSeg.map((obs, i) => {
    const newest = obs.length ? Math.max(...obs.map((o) => new Date(o.observedAt).getTime())) : null;
    const ageDays = newest === null ? null : Math.max(0, Math.round((now - newest) / DAY));
    const latest = (kind: Observation['kind']): ObsValue | null => {
      const list = obs.filter((o) => o.kind === kind).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
      return list[0]?.value ?? null;
    };
    return {
      index: i,
      status: status(ageDays),
      ageDays,
      lighting: latest('lighting'),
      visibility: latest('visibility'),
      observationIds: obs.map((o) => o.id),
      fromKm: (i * segLen) / 1000,
      toKm: ((i + 1) * segLen) / 1000,
    };
  });

  const pct = (s: SegmentStatus) => Math.round((segments.filter((x) => x.status === s).length / SEGMENTS) * 100);

  // Assistance points near the route, with along-route positions for gap analysis
  const near: (AssistPoint & { alongM: number })[] = [];
  for (const a of assistCandidates) {
    const pr = projectOnPolyline(a, polyline);
    if (pr.distanceM <= ASSIST_RADIUS_M) near.push({ ...a, offRouteM: Math.round(pr.distanceM), alongM: pr.alongM });
  }
  near.sort((a, b) => a.alongM - b.alongM);
  let gap = 0;
  let prev = 0;
  for (const a of near) { gap = Math.max(gap, a.alongM - prev); prev = a.alongM; }
  gap = Math.max(gap, total - prev);

  const newestObs = used.length ? used.reduce((m, o) => (o.observedAt > m ? o.observedAt : m), used[0]!.observedAt) : null;

  return {
    segments,
    coverage: { freshPct: pct('fresh'), agingPct: pct('aging'), outdatedPct: pct('outdated'), missingPct: pct('missing') },
    lightingPoorSegments: segments.filter((s) => s.lighting === 'poor').length,
    lightingGoodSegments: segments.filter((s) => s.lighting === 'good').length,
    assist: near.map(({ alongM: _a, ...rest }) => rest),
    longestAssistGapKm: Math.round((gap / 1000) * 10) / 10,
    newestObservationAt: newestObs,
    observations: used,
    sources: opts.sources,
    simulated: opts.simulated,
    generatedAt: new Date(now).toISOString(),
  };
}

export type { LatLng };
