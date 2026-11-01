import type { AssistPoint, LatLng, LatLngTuple, Place, RouteOption, TravelMode } from '../types';
import { env } from '../env';
import { decodePolyline, simplify, pointAlong, polylineLength } from '../geo';

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const PLACES_TEXT = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_NEARBY = 'https://places.googleapis.com/v1/places:searchNearby';

const MODE: Record<TravelMode, string> = { walk: 'WALK', drive: 'DRIVE', transit: 'TRANSIT' };
const wp = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

export async function googleSearchPlaces(q: string): Promise<Place[]> {
  const res = await fetch(PLACES_TEXT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.googleServerKey, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location' },
    body: JSON.stringify({ textQuery: q, maxResultCount: 6 }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Places ${res.status}`);
  const j = (await res.json()) as { places?: { id: string; displayName?: { text: string }; formattedAddress?: string; location: { latitude: number; longitude: number } }[] };
  return (j.places ?? []).map((p) => ({ name: [p.displayName?.text, p.formattedAddress].filter(Boolean).join(' — '), lat: p.location.latitude, lng: p.location.longitude, placeId: p.id, source: 'google' as const }));
}

export interface GoogleRoute { label: string; summary: string; distanceM: number; durationS: number; polyline: LatLngTuple[] }

export async function googleComputeRoutes(origin: LatLng, dest: LatLng, mode: TravelMode): Promise<GoogleRoute[]> {
  const body: Record<string, unknown> = {
    origin: wp(origin), destination: wp(dest), travelMode: MODE[mode], computeAlternativeRoutes: true,
    languageCode: 'en-IN', units: 'METRIC',
  };
  if (mode === 'drive') body.routingPreference = 'TRAFFIC_AWARE';
  const res = await fetch(ROUTES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.googleServerKey, 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.routeLabels' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Routes ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { routes?: { duration: string; distanceMeters: number; polyline: { encodedPolyline: string }; description?: string; routeLabels?: string[] }[] };
  return (j.routes ?? []).slice(0, 3).map((r, i) => ({
    label: `Route ${String.fromCharCode(65 + i)}${r.description ? ` · ${r.description}` : ''}`,
    summary: r.routeLabels?.includes('DEFAULT_ROUTE') ? 'Google’s default route' : r.routeLabels?.includes('FUEL_EFFICIENT') ? 'Fuel-efficient alternative' : 'Alternative route',
    distanceM: r.distanceMeters,
    durationS: parseInt(r.duration, 10) || 0,
    polyline: simplify(decodePolyline(r.polyline.encodedPolyline)),
  }));
}

/** Police / hospital / pharmacy near sample points along the route. Opening hours are Google's, not ours. */
export async function googleAssistAlong(polyline: LatLngTuple[]): Promise<AssistPoint[]> {
  const total = polylineLength(polyline);
  const samples = Math.min(6, Math.max(2, Math.ceil(total / 1500)));
  const seen = new Map<string, AssistPoint>();
  await Promise.all(Array.from({ length: samples }, async (_, i) => {
    const c = pointAlong(polyline, (total * (i + 0.5)) / samples);
    try {
      const res = await fetch(PLACES_NEARBY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.googleServerKey, 'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.types,places.currentOpeningHours.openNow' },
        body: JSON.stringify({ includedTypes: ['police', 'hospital', 'pharmacy'], maxResultCount: 8, locationRestriction: { circle: { center: { latitude: c.lat, longitude: c.lng }, radius: 400 } } }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const j = (await res.json()) as { places?: { id: string; displayName?: { text: string }; location: { latitude: number; longitude: number }; types?: string[]; currentOpeningHours?: { openNow?: boolean } }[] };
      for (const p of j.places ?? []) {
        const kind: AssistPoint['kind'] = p.types?.includes('police') ? 'police' : p.types?.includes('hospital') ? 'hospital' : 'pharmacy';
        seen.set(p.id, { id: p.id, kind, name: p.displayName?.text ?? kind, lat: p.location.latitude, lng: p.location.longitude, openNow: p.currentOpeningHours?.openNow ?? null, source: 'google' });
      }
    } catch { /* partial results are fine; gaps are reported as gaps */ }
  }));
  return [...seen.values()];
}
export type { Place };
