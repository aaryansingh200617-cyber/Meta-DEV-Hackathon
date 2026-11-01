import type { Journey, JourneyEvent, Relay, RouteOption } from '../types';
import { ASSIST_RADIUS_M, FRESH_DAYS, OUTDATED_DAYS } from '../defaults';
import { fmtDistance, fmtDuration } from '../utils';

export interface Fact { id: string; text: string; routeId?: string }

const KIND: Record<string, string> = { police: 'police', hospital: 'hospital/clinic', pharmacy: 'pharmacy', transit: 'transit stop', open_late: 'late-night shop' };

/** Deterministic, numbered statements the AI may cite. The model never sees anything that is not in here. */
export function routeFacts(routes: RouteOption[]): Fact[] {
  const facts: Fact[] = [];
  let n = 1;
  const add = (text: string, routeId?: string) => facts.push({ id: `F${n++}`, text, routeId });
  for (const r of routes) {
    const ev = r.evidence;
    add(`${r.label}: ${fmtDistance(r.distanceM)}, about ${fmtDuration(r.durationS)}.`, r.id);
    add(`${r.label}: of 24 route segments, ${ev.coverage.freshPct}% have an observation from the last ${FRESH_DAYS} days, ${ev.coverage.agingPct}% have one that is ${FRESH_DAYS + 1}–${OUTDATED_DAYS} days old, ${ev.coverage.outdatedPct}% only have one older than ${OUTDATED_DAYS} days (outdated), and ${ev.coverage.missingPct}% have no observation at all (missing data).`, r.id);
    add(`${r.label}: where lighting was observed, ${ev.lightingPoorSegments} segment(s) were reported "poor" and ${ev.lightingGoodSegments} "good".`, r.id);
    const kinds = [...new Set(ev.assist.map((a) => KIND[a.kind] ?? a.kind))].join(', ');
    add(`${r.label}: ${ev.assist.length} assistance location(s) within ${ASSIST_RADIUS_M} m of the route${kinds ? ` (${kinds})` : ''}; the longest stretch without one is about ${ev.longestAssistGapKm} km.`, r.id);
    add(ev.newestObservationAt ? `${r.label}: newest observation is dated ${new Date(ev.newestObservationAt).toISOString().slice(0, 10)}.` : `${r.label}: no dated observations are available.`, r.id);
  }
  if (routes.some((r) => r.simulated)) add('These routes, observations and assistance locations are SIMULATED demonstration data, not real conditions.');
  add('Observations describe what was seen at a past time. They are not a guarantee of safety now.');
  return facts;
}

export function journeyFacts(j: Journey, events: JourneyEvent[], relays: Relay[]): Fact[] {
  const t = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const facts: Fact[] = [];
  let n = 1;
  const add = (text: string) => facts.push({ id: `E${n++}`, text });
  add(`Journey ${j.origin.name} to ${j.destination.name} by ${j.mode}, started ${t(j.startedAt)}, expected arrival ${t(j.expectedArrivalAt)}${j.endedAt ? `, ended ${t(j.endedAt)} (${j.endReason})` : ', still in progress'}.`);
  for (const e of [...events].sort((a, b) => a.at.localeCompare(b.at))) add(`${t(e.at)} — ${e.message}`);
  add(`${relays.length} help request(s) were made during this journey.`);
  return facts;
}
