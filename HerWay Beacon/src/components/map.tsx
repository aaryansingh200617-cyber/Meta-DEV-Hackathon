'use client';
import * as React from 'react';
import type { AssistPoint, LatLng, LatLngTuple } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface MapRoute {
  id: string;
  polyline: LatLngTuple[];
  color: string;
  selected?: boolean;
  label?: string;
  safetyTier?: string;
  safetyLabel?: string;
}

export interface MapProps {
  routes?: MapRoute[];
  origin?: (LatLng & { name?: string }) | null;
  destination?: (LatLng & { name?: string }) | null;
  position?: (LatLng & { simulated?: boolean }) | null;
  trail?: LatLngTuple[];
  assist?: AssistPoint[];
  className?: string;
  caption?: boolean;
  onSelectRoute?: (routeId: string) => void;
}

export const ROUTE_COLORS = ['#10B981', '#1877F2', '#94A3B8'];
const GKEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// High-definition, 100% free tile layers with ZERO watermark and NO API key required
const TILES = {
  streets: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  esri: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
};

/**
 * Universal Safe Map:
 * 1. Uses Google Maps if client key is configured.
 * 2. Uses High-Definition Street Tile Map (Free, Worldwide, No Watermark, No Key Required).
 * 3. Falls back to SVG Schematic if completely offline without network.
 */
export function SafeMap(props: MapProps) {
  const [googleFailed, setGoogleFailed] = React.useState(false);
  const [leafletFailed, setLeafletFailed] = React.useState(false);

  if (GKEY && !googleFailed) {
    return <GoogleMapView {...props} onFail={() => setGoogleFailed(true)} />;
  }

  if (!leafletFailed) {
    return <TileMapView {...props} onFail={() => setLeafletFailed(true)} />;
  }

  return <SchematicMap {...props} />;
}

/* ───────────────────────── Google-Style High-Definition Tile Map ───────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */
let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L && typeof w.L.map === 'function') return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    // Inject CSS
    if (!document.getElementById('leaflet-core-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-core-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Inject Script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = () => reject(new Error('Leaflet failed to load'));
    document.head.appendChild(script);

    setTimeout(() => {
      if ((window as any).L) resolve((window as any).L);
      else reject(new Error('Leaflet load timeout'));
    }, 10000);
  });

  return leafletPromise;
}

function TileMapView({
  routes = [],
  origin,
  destination,
  position,
  trail,
  assist = [],
  className,
  caption = true,
  onSelectRoute,
  onFail,
}: MapProps & { onFail: () => void }) {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<any>(null);
  const layerGroupRef = React.useRef<any>(null);   // routes, origin, dest, assist, trail
  const posMarkerRef = React.useRef<any>(null);     // live position marker (separate layer)
  const tileLayerRef = React.useRef<any>(null);
  const hasFittedRef = React.useRef(false);         // has bounds been fitted once?
  const [mapType, setMapType] = React.useState<'streets' | 'satellite'>('streets');
  const [loading, setLoading] = React.useState(true);
  const [mapReady, setMapReady] = React.useState(false);

  const [isFollowing, setIsFollowing] = React.useState(true);

  // Initialize Map
  React.useEffect(() => {
    let active = true;

    loadLeaflet()
      .then((L) => {
        if (!active || !mapContainerRef.current) return;

        if (!mapInstanceRef.current) {
          const map = L.map(mapContainerRef.current, {
            center: [28.6139, 77.209], // Default Delhi center
            zoom: 12,
            zoomControl: false,
            attributionControl: false,
          });

          L.control.zoom({ position: 'bottomright' }).addTo(map);

          map.on('dragstart', () => {
            setIsFollowing(false);
          });

          // Esri World Street Map: Clean, high-contrast, zero watermark, looks just like Google Maps
          const streetLayer = L.tileLayer(TILES.streets, {
            maxZoom: 19,
          });

          streetLayer.addTo(map);
          tileLayerRef.current = streetLayer;

          layerGroupRef.current = L.layerGroup().addTo(map);
          mapInstanceRef.current = map;
        }

        setMapReady(true);
        setLoading(false);
      })
      .catch(() => {
        if (active) onFail();
      });

    return () => {
      active = false;
    };
  }, [onFail]);

  // Handle Layer Toggle (Streets vs Satellite)
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    const w = window as any;
    if (!map || !w.L) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl = mapType === 'satellite' ? TILES.satellite : TILES.streets;
    tileLayerRef.current = w.L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);
  }, [mapType]);

  // Effect 1: Routes, origin, destination, assist, trail — redraw layers and fitBounds
  const routeSig = React.useMemo(() => {
    return JSON.stringify({
      routes: routes.map((r) => ({
        id: r.id,
        selected: !!r.selected,
        tier: r.safetyTier,
        len: r.polyline?.length ?? 0,
      })),
      origin: origin ? [origin.lat, origin.lng] : null,
      destination: destination ? [destination.lat, destination.lng] : null,
      assist: assist.map((a) => a.id),
      trailLen: trail?.length ?? 0,
    });
  }, [routes, origin, destination, assist, trail]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    const w = window as any;
    if (!map || !group || !w.L) return;

    const L = w.L;
    group.clearLayers();

    const boundsPoints: [number, number][] = [];

    // 1. Draw Routes (Solid lines like Google Maps, colored by safety tier)
    // Order from bottom to top so that:
    // - Unselected regular routes (direct/balanced) are at the bottom
    // - Safest route is always elevated so its green line is never completely hidden by overlapping roads
    // - Currently selected route is on top with its glowing white halo
    const sortedRoutes = [...routes].sort((a, b) => {
      const aTierScore = a.safetyTier === 'safest' ? 2 : a.safetyTier === 'balanced' ? 1 : 0;
      const bTierScore = b.safetyTier === 'safest' ? 2 : b.safetyTier === 'balanced' ? 1 : 0;
      const aScore = (a.selected ? 100 : 0) + aTierScore;
      const bScore = (b.selected ? 100 : 0) + bTierScore;
      return aScore - bScore;
    });

    for (const r of sortedRoutes) {
      if (!r.polyline || !r.polyline.length) continue;
      const pts = r.polyline.map((p) => [p[0], p[1]] as [number, number]);
      pts.forEach((p) => boundsPoints.push(p));

      const isSafest = r.safetyTier === 'safest';
      const isSelected = !!r.selected;

      // Safety-tier colors: safest=vibrant emerald green, balanced=blue, direct=slate
      const tierColor = isSafest
        ? '#059669' // rich high-visibility emerald green
        : r.safetyTier === 'balanced'
          ? '#1877F2'
          : r.safetyTier === 'direct'
            ? '#64748B'
            : r.color || '#059669';

      // White outline casing:
      // If selected: thick white casing
      // If safest (even unselected): subtle white casing so the green line never gets lost against street tiles or overlapping lines
      if (isSelected) {
        L.polyline(pts, {
          color: '#ffffff',
          weight: 10,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(group);
      } else if (isSafest) {
        L.polyline(pts, {
          color: '#ffffff',
          weight: 7,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(group);
      }

      // Main route polyline
      const line = L.polyline(pts, {
        color: tierColor,
        weight: isSelected ? 6.5 : (isSafest ? 5 : 3.5),
        opacity: isSelected ? 1 : (isSafest ? 0.95 : 0.65),
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);

      if (onSelectRoute) {
        line.on('click', () => onSelectRoute(r.id));
        line.setStyle({ cursor: 'pointer' });
      }

      // Safety label tooltip on the route line
      const popupLabel = isSafest
        ? (r.safetyLabel || '🛡️ Safest Route')
        : (r.safetyLabel ?? r.label ?? '');

      if (popupLabel) {
        line.bindTooltip(popupLabel, {
          permanent: isSelected || (isSafest && routes.length > 1),
          direction: 'center',
          className: isSafest ? 'leaflet-safety-label leaflet-safety-label-safest' : 'leaflet-safety-label',
          opacity: 0.95,
        });
      }
    }

    // 2. Draw GPS Trail
    if (trail && trail.length > 1) {
      const trailPts = trail.map((p) => [p[0], p[1]] as [number, number]);
      trailPts.forEach((p) => boundsPoints.push(p));
      L.polyline(trailPts, {
        color: '#1877F2',
        weight: 3,
        opacity: 0.8,
        dashArray: '2, 6',
      }).addTo(group);
    }

    // 3. Start Marker (Green Google Maps Teardrop Pin "A")
    if (origin) {
      boundsPoints.push([origin.lat, origin.lng]);
      const startIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="position:relative; width:32px; height:38px; display:flex; justify-content:center; filter:drop-shadow(0 3px 5px rgba(0,0,0,0.35));">
            <svg viewBox="0 0 32 38" width="32" height="38" fill="none">
              <path d="M16 0C7.16 0 0 7.16 0 16c0 10.5 14 21 15.3 21.9.4.3 1 .3 1.4 0C18 37 32 26.5 32 16 32 7.16 24.84 0 16 0z" fill="#10B981" stroke="#ffffff" stroke-width="1.5"/>
              <circle cx="16" cy="14" r="8" fill="#ffffff"/>
              <text x="16" y="18" text-anchor="middle" font-size="11" font-weight="800" font-family="system-ui,sans-serif" fill="#10B981">A</text>
            </svg>
          </div>
        `,
        iconSize: [32, 38],
        iconAnchor: [16, 38],
      });
      L.marker([origin.lat, origin.lng], { icon: startIcon, title: origin.name || 'Start' })
        .bindPopup(`<b>Starting Point (A)</b><br/>${origin.name || 'Origin'}`)
        .addTo(group);
    }

    // 4. Destination Marker (Red Google Maps Teardrop Pin "B")
    if (destination) {
      boundsPoints.push([destination.lat, destination.lng]);
      const destIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="position:relative; width:32px; height:38px; display:flex; justify-content:center; filter:drop-shadow(0 3px 5px rgba(0,0,0,0.35));">
            <svg viewBox="0 0 32 38" width="32" height="38" fill="none">
              <path d="M16 0C7.16 0 0 7.16 0 16c0 10.5 14 21 15.3 21.9.4.3 1 .3 1.4 0C18 37 32 26.5 32 16 32 7.16 24.84 0 16 0z" fill="#EF4444" stroke="#ffffff" stroke-width="1.5"/>
              <circle cx="16" cy="14" r="8" fill="#ffffff"/>
              <text x="16" y="18" text-anchor="middle" font-size="11" font-weight="800" font-family="system-ui,sans-serif" fill="#EF4444">B</text>
            </svg>
          </div>
        `,
        iconSize: [32, 38],
        iconAnchor: [16, 38],
      });
      L.marker([destination.lat, destination.lng], { icon: destIcon, title: destination.name || 'Destination' })
        .bindPopup(`<b>Destination (B)</b><br/>${destination.name || 'Destination'}`)
        .addTo(group);
    }

    // 5. Assistance Points along route
    for (const a of assist) {
      const color =
        a.kind === 'police' ? '#0B1F3A' : a.kind === 'hospital' ? '#B42318' : '#1877F2';
      const badge =
        a.kind === 'police' ? '👮' : a.kind === 'hospital' ? '🏥' : '💊';

      const assistIcon = L.divIcon({
        className: 'custom-map-assist',
        html: `<div style="background:#ffffff; border:2px solid ${color}; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; box-shadow:0 2px 6px rgba(0,0,0,0.25);">${badge}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      L.marker([a.lat, a.lng], { icon: assistIcon, title: a.name })
        .bindPopup(`<b>${a.name}</b><br/>Type: ${a.kind.toUpperCase()}${a.openNow ? '<br/><span style="color:#10B981;">● Open now</span>' : ''}`)
        .addTo(group);
    }

    // Auto-fit bounds to view all route/origin/dest
    if (boundsPoints.length > 0) {
      map.invalidateSize();
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
      hasFittedRef.current = true;
    }
  }, [mapReady, routeSig, onSelectRoute]);

  // Effect 2: Position/live location ONLY — update smoothly without recreating marker or reset bounds
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    const w = window as any;
    if (!map || !w.L) return;

    const L = w.L;

    if (!position) {
      if (posMarkerRef.current) {
        map.removeLayer(posMarkerRef.current);
        posMarkerRef.current = null;
      }
      return;
    }

    if (!posMarkerRef.current) {
      const posIcon = L.divIcon({
        className: 'custom-map-pos',
        html: `<div style="position:relative; width:26px; height:26px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; width:100%; height:100%; border-radius:50%; background:#1877F2; opacity:0.35; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width:14px; height:14px; border-radius:50%; background:#1877F2; border:2.5px solid #ffffff; box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>
        </div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const marker = L.marker([position.lat, position.lng], { icon: posIcon, title: 'Your Position' })
        .bindPopup('<b>Current Location</b>')
        .addTo(map);
      posMarkerRef.current = marker;
    } else {
      // Smoothly update position without resetting CSS ping animations
      posMarkerRef.current.setLatLng([position.lat, position.lng]);
    }

    // Google Maps style: smoothly follow user when following mode is active
    if (isFollowing) {
      if (hasFittedRef.current) {
        map.panTo([position.lat, position.lng], { animate: true, duration: 0.8 });
      } else {
        map.setView([position.lat, position.lng], 15);
        hasFittedRef.current = true;
      }
    }
  }, [position?.lat, position?.lng, isFollowing]);

  const recenter = () => {
    setIsFollowing(true);
    const map = mapInstanceRef.current;
    if (map && position) {
      map.panTo([position.lat, position.lng], { animate: true, duration: 0.5 });
    }
  };

  return (
    <div className={cn('relative h-[260px] xs:h-[300px] sm:h-[350px] md:aspect-[18/11] md:h-auto md:min-h-[350px] w-full overflow-hidden rounded-2xl border bg-surface shadow-sm', className)}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-xs text-xs sm:text-sm font-medium text-muted-foreground p-3 text-center">
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading High-Definition Live Map...
          </span>
        </div>
      )}

      {/* Layer Switcher & Re-center (Google Maps Style) */}
      <div className="absolute right-2 top-2 sm:right-3 sm:top-3 z-[1000] flex items-center gap-1.5 sm:gap-2">
        {position && (
          <button
            type="button"
            onClick={recenter}
            title={isFollowing ? 'Following location' : 'Re-center on my location'}
            aria-label="Re-center on my location"
            className={cn(
              'flex h-7 sm:h-8 items-center gap-1 sm:gap-1.5 rounded-xl border bg-background/95 px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold shadow-md backdrop-blur-xs transition-all active:scale-95',
              isFollowing
                ? 'border-primary/50 text-primary ring-1 ring-primary/30'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className={cn('h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full', isFollowing ? 'bg-primary animate-pulse' : 'bg-muted-foreground')} />
            {isFollowing ? 'Following' : 'Re-center'}
          </button>
        )}
        <div className="flex overflow-hidden rounded-xl border bg-background/90 p-0.5 shadow-md backdrop-blur-xs">
          <button
            type="button"
            onClick={() => setMapType('streets')}
            className={cn(
              'px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-semibold transition-colors rounded-lg',
              mapType === 'streets'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => setMapType('satellite')}
            className={cn(
              'px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-semibold transition-colors rounded-lg',
              mapType === 'satellite'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Satellite
          </button>
        </div>
      </div>

      <div ref={mapContainerRef} className="h-full w-full" style={{ zIndex: 1 }} />

      {caption && (
        <div className="absolute bottom-2 left-2 z-[1000] flex flex-col gap-1 max-w-[calc(100%-80px)] pointer-events-none">
          <div className="hidden xs:block rounded-lg bg-background/90 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-muted-foreground shadow-xs backdrop-blur-xs pointer-events-auto">
            Live Interactive Road Map
          </div>
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 rounded-lg bg-background/90 px-2 py-0.5 sm:py-1 shadow-xs backdrop-blur-xs pointer-events-auto">
            <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-emerald-700"><span className="inline-block h-1.5 sm:h-2 w-3 sm:w-4 rounded-full bg-emerald-500" />Safest</span>
            <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-blue-700"><span className="inline-block h-1.5 sm:h-2 w-3 sm:w-4 rounded-full bg-[#1877F2]" />Balanced</span>
            <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-slate-500"><span className="inline-block h-1.5 sm:h-2 w-3 sm:w-4 rounded-full bg-slate-400" />Direct</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Schematic SVG map (Fallback only) ───────────────────────── */

const W = 720, H = 440, PAD = 44;
const ASSIST_STYLE: Record<AssistPoint['kind'], { c: string; t: string; n: string }> = {
  police: { c: '#0B1F3A', t: 'P', n: 'Police' },
  hospital: { c: '#B42318', t: 'H', n: 'Hospital / clinic' },
  pharmacy: { c: '#1877F2', t: 'Rx', n: 'Pharmacy' },
  transit: { c: '#475569', t: 'T', n: 'Transit' },
  open_late: { c: '#92580A', t: '•', n: 'Open late' },
};

function SchematicMap({
  routes = [],
  origin,
  destination,
  position,
  trail,
  assist = [],
  className,
  caption = true,
}: MapProps) {
  const pts: LatLng[] = [];
  routes.forEach((r) => r.polyline.forEach((p) => pts.push({ lat: p[0], lng: p[1] })));
  [origin, destination, position].forEach((p) => p && pts.push(p));
  trail?.forEach((p) => pts.push({ lat: p[0], lng: p[1] }));
  if (!pts.length) {
    return (
      <div
        className={cn(
          'grid aspect-[18/11] place-items-center rounded-2xl border bg-surface text-sm text-muted-foreground',
          className,
        )}
      >
        Map preview appears once you compare routes
      </div>
    );
  }

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  pts.forEach((p) => {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  });
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * k, 1e-5);
  const spanY = Math.max(maxLat - minLat, 1e-5);
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
  const X = (lng: number) => offX + (lng - minLng) * k * scale;
  const Y = (lat: number) => H - (offY + (lat - minLat) * scale);
  const path = (pl: LatLngTuple[]) =>
    pl.map((p, i) => `${i ? 'L' : 'M'}${X(p[1]).toFixed(1)},${Y(p[0]).toFixed(1)}`).join(' ');

  const ordered = [...routes].sort((a, b) => {
    const aTier = a.safetyTier === 'safest' ? 2 : a.safetyTier === 'balanced' ? 1 : 0;
    const bTier = b.safetyTier === 'safest' ? 2 : b.safetyTier === 'balanced' ? 1 : 0;
    return (Number(!!a.selected) * 10 + aTier) - (Number(!!b.selected) * 10 + bTier);
  });
  return (
    <figure className={cn('overflow-hidden rounded-2xl border bg-surface', className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Schematic map of the routes"
        className="block h-auto w-full"
      >
        <defs>
          <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M36 0H0V36" fill="none" stroke="#E2E8F0" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="#F6F7F9" />
        <rect width={W} height={H} fill="url(#grid)" />
        {ordered.map((r) => {
          const isSafest = r.safetyTier === 'safest';
          const tierColor = isSafest
            ? '#059669'
            : r.safetyTier === 'balanced'
              ? '#1877F2'
              : r.safetyTier === 'direct'
                ? '#64748B'
                : r.color || '#059669';
          return (
            <g key={r.id}>
              {r.selected ? (
                <path
                  d={path(r.polyline)}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : isSafest ? (
                <path
                  d={path(r.polyline)}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              <path
                d={path(r.polyline)}
                fill="none"
                stroke={tierColor}
                strokeWidth={r.selected ? 6 : (isSafest ? 4.5 : 3)}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={r.selected || isSafest ? undefined : '2 7'}
                opacity={r.selected || isSafest || routes.length === 1 ? 1 : 0.75}
              />
            </g>
          );
        })}
        {trail && trail.length > 1 && (
          <path
            d={path(trail)}
            fill="none"
            stroke="#1877F2"
            strokeWidth="3"
            strokeDasharray="1 6"
            strokeLinecap="round"
          />
        )}
        {assist.map((a) => {
          const s = ASSIST_STYLE[a.kind];
          return (
            <g key={a.id} transform={`translate(${X(a.lng).toFixed(1)},${Y(a.lat).toFixed(1)})`}>
              <title>{`${a.name}${a.source === 'demo' ? ' — simulated' : ''}`}</title>
              <circle r="9" fill="#fff" stroke={s.c} strokeWidth="1.6" />
              <text textAnchor="middle" dy="3.5" fontSize={s.t.length > 1 ? 8.5 : 10} fontWeight="700" fill={s.c}>
                {s.t}
              </text>
            </g>
          );
        })}
        {origin && (
          <g transform={`translate(${X(origin.lng)},${Y(origin.lat)})`}>
            <circle r="9" fill="#fff" stroke="#0B1F3A" strokeWidth="3" />
            <circle r="3" fill="#0B1F3A" />
          </g>
        )}
        {destination && (
          <g transform={`translate(${X(destination.lng)},${Y(destination.lat)})`}>
            <path
              d="M0 0c-9-10-11-17-11-21a11 11 0 0 1 22 0c0 4-2 11-11 21z"
              fill="#0B1F3A"
              transform="translate(0,2)"
            />
            <circle cy="-19" r="4" fill="#fff" />
          </g>
        )}
        {position && (
          <g transform={`translate(${X(position.lng)},${Y(position.lat)})`}>
            <circle r="16" fill="#1877F2" opacity=".16" />
            <circle r="8" fill="#1877F2" stroke="#fff" strokeWidth="3" />
          </g>
        )}
      </svg>
      {caption && (
        <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t bg-background px-3.5 py-2 text-xs text-muted-foreground">
          <span>Schematic fallback preview. Connect to internet for live street tiles.</span>
        </figcaption>
      )}
    </figure>
  );
}

/* ───────────────────────── Google Maps (If browser key set) ───────────────────────── */

let googleLoader: Promise<any> | null = null;
function loadGoogle(): Promise<any> {
  const w = window as any;
  if (w.google?.maps) return Promise.resolve(w.google);
  if (googleLoader) return googleLoader;
  googleLoader = new Promise((resolve, reject) => {
    w.__sjMapReady = () => resolve(w.google);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GKEY}&callback=__sjMapReady&loading=async&v=weekly`;
    s.async = true;
    s.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('Google Maps timed out')), 12000);
  });
  return googleLoader;
}

function GoogleMapView({
  routes = [],
  origin,
  destination,
  position,
  trail,
  assist = [],
  className,
  onFail,
}: MapProps & { onFail: () => void }) {
  const el = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<any>(null);
  const overlays = React.useRef<any[]>([]);
  const fitted = React.useRef('');

  React.useEffect(() => {
    let cancelled = false;
    loadGoogle()
      .then((g) => {
        if (cancelled || !el.current) return;
        if (!map.current) {
          map.current = new g.maps.Map(el.current, {
            center: { lat: 20.5, lng: 78.9 },
            zoom: 5,
            disableDefaultUI: true,
            zoomControl: true,
            clickableIcons: false,
          });
        }
        overlays.current.forEach((o) => o.setMap(null));
        overlays.current = [];
        const bounds = new g.maps.LatLngBounds();
        const add = (o: any) => overlays.current.push(o);
        const ll = (p: LatLng) => ({ lat: p.lat, lng: p.lng });

        routes.forEach((r) => {
          const path = r.polyline.map((p) => ({ lat: p[0], lng: p[1] }));
          path.forEach((p) => bounds.extend(p));
          const isSafest = r.safetyTier === 'safest';
          const tierColor = isSafest
            ? '#059669'
            : r.safetyTier === 'balanced'
              ? '#1877F2'
              : r.safetyTier === 'direct'
                ? '#64748B'
                : r.color || '#059669';

          if (r.selected) {
            add(
              new g.maps.Polyline({
                map: map.current,
                path,
                strokeColor: '#ffffff',
                strokeWeight: 10,
                strokeOpacity: 0.95,
                zIndex: 4,
              }),
            );
          } else if (isSafest) {
            add(
              new g.maps.Polyline({
                map: map.current,
                path,
                strokeColor: '#ffffff',
                strokeWeight: 7,
                strokeOpacity: 0.85,
                zIndex: 2,
              }),
            );
          }

          add(
            new g.maps.Polyline({
              map: map.current,
              path,
              strokeColor: tierColor,
              strokeWeight: r.selected ? 6.5 : (isSafest ? 5 : 3.5),
              strokeOpacity: r.selected ? 1 : (isSafest ? 0.95 : 0.65),
              zIndex: r.selected ? 5 : (isSafest ? 3 : 1),
            }),
          );
        });

        if (trail?.length) {
          add(
            new g.maps.Polyline({
              map: map.current,
              path: trail.map((p) => ({ lat: p[0], lng: p[1] })),
              strokeColor: '#1877F2',
              strokeWeight: 3,
              strokeOpacity: 0.7,
              zIndex: 3,
            }),
          );
        }

        const dot = (p: LatLng, fill: string, scale: number, title: string) => {
          bounds.extend(ll(p));
          add(
            new g.maps.Marker({
              map: map.current,
              position: ll(p),
              title,
              icon: {
                path: g.maps.SymbolPath.CIRCLE,
                scale,
                fillColor: fill,
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 3,
              },
            }),
          );
        };

        if (origin) dot(origin, '#0B1F3A', 8, 'Start');
        if (destination) dot(destination, '#B42318', 8, 'Destination');
        if (position)
          dot(
            position,
            '#1877F2',
            9,
            position.simulated ? 'Current position (simulated)' : 'Current position',
          );

        assist.forEach((a) =>
          add(
            new g.maps.Marker({
              map: map.current,
              position: { lat: a.lat, lng: a.lng },
              title: a.name,
              icon: {
                path: g.maps.SymbolPath.CIRCLE,
                scale: 5,
                fillColor: '#fff',
                fillOpacity: 1,
                strokeColor: '#0B1F3A',
                strokeWeight: 2,
              },
            }),
          ),
        );

        const sig =
          routes.map((r) => r.id).join() + (origin ? 'o' : '') + (destination ? 'd' : '');
        if (fitted.current !== sig && !bounds.isEmpty()) {
          map.current.fitBounds(bounds, 48);
          fitted.current = sig;
        } else if (position && !routes.length) {
          map.current.panTo(ll(position));
        }
      })
      .catch(() => onFail());

    return () => {
      cancelled = true;
    };
  }, [routes, origin, destination, position, trail, assist, onFail]);

  return (
    <div
      ref={el}
      role="application"
      aria-label="Map"
      className={cn('h-[260px] xs:h-[300px] sm:h-[350px] md:aspect-[18/11] md:h-auto md:min-h-[350px] w-full overflow-hidden rounded-2xl border bg-surface', className)}
    />
  );
}
