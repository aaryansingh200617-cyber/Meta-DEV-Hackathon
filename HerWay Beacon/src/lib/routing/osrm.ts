import type { AssistPoint, LatLng, LatLngTuple, Place, TravelMode } from '../types';
import { simplify, polylineLength, pointAlong } from '../geo';
import { generateRouteVariants, rankBySafety } from './safety';
import type { ScoredRoute } from './safety';

export type { ScoredRoute };

const OSRM_BASE = 'https://router.project-osrm.org/route/v1';
const PHOTON_URL = 'https://photon.komoot.io/api';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export interface OSRMRouteResult {
  label: string;
  summary: string;
  distanceM: number;
  durationS: number;
  polyline: LatLngTuple[];
  steps?: { name?: string; distance?: number }[];
}

/**
 * Live search for places globally using OpenStreetMap Nominatim with Photon fallback.
 */
export async function osrmSearchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (!q) return [];

  // Try OpenStreetMap Nominatim first (fastest and most reliable worldwide OSM search)
  try {
    const res = await fetch(
      `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'HerWayBeacon/1.0 (safety-routing)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(2500),
      },
    );
    if (res.ok) {
      const items = (await res.json()) as {
        display_name: string;
        lat: string;
        lon: string;
        place_id: number;
      }[];
      if (items.length > 0) {
        return items.map((item) => ({
          name: item.display_name.split(',').slice(0, 3).join(', ').trim(),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          placeId: `nom-${item.place_id}`,
          source: 'osrm' as const,
        }));
      }
    }
  } catch {
    // Proceed to fallback
  }

  // Fallback to Photon
  try {
    const res = await fetch(`${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=6`, {
      headers: { 'User-Agent': 'HerWayBeacon/1.0' },
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        features?: {
          geometry: { coordinates: [number, number] };
          properties: {
            name?: string;
            street?: string;
            city?: string;
            district?: string;
            state?: string;
            country?: string;
            osm_id?: number;
          };
        }[];
      };

      if (data.features && data.features.length > 0) {
        return data.features.map((f) => {
          const p = f.properties;
          const parts = [p.name || p.street, p.district, p.city, p.state].filter(Boolean);
          const fullName = parts.length > 0 ? parts.join(', ') : `${f.geometry.coordinates[1].toFixed(4)}, ${f.geometry.coordinates[0].toFixed(4)}`;
          return {
            name: fullName,
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            placeId: `osm-${p.osm_id || Math.random().toString(36).slice(2, 8)}`,
            source: 'osrm' as const,
          };
        });
      }
    }
  } catch {
    // Both failed
  }

  return [];
}

/**
 * Live road-network routing using OSRM (Open Source Routing Machine on OpenStreetMap roads).
 * Returns up to 3 safety-ranked route alternatives.
 */
export async function osrmComputeRoutes(
  origin: LatLng,
  dest: LatLng,
  mode: TravelMode,
): Promise<ScoredRoute[]> {
  const profile = mode === 'walk' ? 'foot' : 'driving';
  const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
  const url = `${OSRM_BASE}/${profile}/${coords}?overview=full&geometries=geojson&alternatives=true&steps=true`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'HerWayBeacon/1.0' },
    signal: AbortSignal.timeout(9000),
  });

  if (!res.ok) {
    throw new Error(`OSRM routing returned HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    code: string;
    routes?: {
      distance: number;
      duration: number;
      geometry: { coordinates: [number, number][] };
      legs?: { summary?: string; steps?: { name?: string; distance?: number }[] }[];
    }[];
  };

  if (json.code !== 'Ok' || !json.routes || json.routes.length === 0) {
    throw new Error(`OSRM routing failed with code: ${json.code}`);
  }

  // Parse raw OSRM routes
  const rawRoutes: OSRMRouteResult[] = json.routes.slice(0, 3).map((r, i) => {
    const leg = r.legs?.[0];
    const topStreet =
      leg?.summary?.trim() ||
      leg?.steps
        ?.map((s) => s.name?.trim())
        .filter((n): n is string => Boolean(n && n.length > 2))[0] ||
      (i === 0 ? 'Main roadway' : `Alternative road ${i}`);

    const distM = Math.round(r.distance);

    let durationS: number;
    let modePrefix = '';
    let summary = '';

    if (mode === 'walk') {
      durationS = Math.round(distM / 1.333);
      modePrefix = 'Walking';
      summary = i === 0 ? 'Direct pedestrian route · Pace ~4.8 km/h' : 'Pedestrian alternative route';
    } else if (mode === 'drive') {
      const cityTrafficPacing = Math.round(r.duration * 1.35);
      const minDriveTime = Math.round(distM / (35000 / 3600));
      durationS = Math.max(cityTrafficPacing, minDriveTime);
      modePrefix = 'Cab / Drive';
      summary = i === 0 ? 'Fastest vehicle route via road network' : 'Alternative road connection';
    } else {
      const transitTravelS = Math.round(distM / (22000 / 3600));
      const avgWaitS = 330;
      durationS = transitTravelS + avgWaitS;
      modePrefix = 'Transit';
      summary = i === 0 ? 'Public transit corridor (Bus / Metro + walk)' : 'Alternative transit connection';
    }

    // Convert GeoJSON [lng, lat] coordinates to LatLngTuple [lat, lng]
    const rawCoords: LatLngTuple[] = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const polyline = simplify(rawCoords);

    // Extract step names and distances for safety and arterial analysis
    const steps = (r.legs?.[0]?.steps ?? []).map((s) => ({
      name: s.name?.trim(),
      distance: s.distance,
    }));

    return {
      label: `Route ${String.fromCharCode(65 + i)} · ${modePrefix} via ${topStreet}`,
      summary,
      distanceM: distM,
      durationS,
      polyline,
      steps,
    };
  });

  // Ensure we have up to 3 route variants (generate geometric detour variants if needed)
  const fullRoutes = await generateRouteVariants(origin, dest, rawRoutes, mode);

  // Safety-rank all routes (Overpass OSM data queries happen here)
  const safetyRanked = await rankBySafety(fullRoutes);

  // Re-label routes after safety ranking (A = Safest, B = Balanced, C = Direct)
  return safetyRanked.map((r, i) => ({
    ...r,
    label: r.label.replace(/^Route [A-C]/, `Route ${String.fromCharCode(65 + i)}`),
  }));
}

/**
 * Searches for real assistance points (police, hospital, pharmacy) along the route
 * using OpenStreetMap Overpass API. Times out cleanly without failing the main route.
 */
export async function osrmAssistAlong(polyline: LatLngTuple[]): Promise<AssistPoint[]> {
  const total = polylineLength(polyline);
  if (total <= 0) return [];

  const samples = Math.min(4, Math.max(2, Math.ceil(total / 2500)));
  const seen = new Map<string, AssistPoint>();

  await Promise.all(
    Array.from({ length: samples }, async (_, i) => {
      const c = pointAlong(polyline, (total * (i + 0.5)) / samples);
      try {
        const query = `[out:json][timeout:3];node["amenity"~"police|hospital|pharmacy"](around:800,${c.lat},${c.lng});out 6;`;
        const res = await fetch(OVERPASS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'HerWayBeacon/1.0' },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(1200),
        });

        if (!res.ok) return;

        const data = (await res.json()) as {
          elements?: {
            id: number;
            lat: number;
            lon: number;
            tags?: { name?: string; amenity?: string; 'opening_hours'?: string };
          }[];
        };

        for (const el of data.elements ?? []) {
          const kind: AssistPoint['kind'] =
            el.tags?.amenity === 'police'
              ? 'police'
              : el.tags?.amenity === 'hospital'
                ? 'hospital'
                : 'pharmacy';
          const name = el.tags?.name || (kind === 'police' ? 'Police Station' : kind === 'hospital' ? 'Hospital' : 'Pharmacy');
          const id = `osm-node-${el.id}`;
          if (!seen.has(id)) {
            seen.set(id, {
              id,
              kind,
              name,
              lat: el.lat,
              lng: el.lon,
              openNow: el.tags?.opening_hours?.includes('24/7') ? true : null,
              source: 'osrm',
            });
          }
        }
      } catch {
        // Resilient: Overpass failures/timeouts are safely ignored
      }
    }),
  );

  return [...seen.values()];
}

