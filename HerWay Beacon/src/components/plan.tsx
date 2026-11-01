'use client';
import * as React from 'react';
import { ArrowDownUp, Bot, Footprints, Bus, Car, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Disclaimer, EmptyState, ErrorState, PageHeader, SimBadge } from '@/components/common';
import { PlaceField } from '@/components/place-field';
import { RouteCard } from '@/components/route-card';
import { SafeMap, ROUTE_COLORS } from '@/components/map';
import { AssistantChat, PREFILL_KEY } from '@/components/assistant-chat';
import { JourneySetup, type SetupPrefill } from '@/components/journey-setup';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/toast';
import { useShell } from '@/components/app-shell';
import { errMsg, post } from '@/lib/client/api';
import { pointAlong } from '@/lib/geo';
import type { Place, RouteOption, TravelMode } from '@/lib/types';
import { cn, fmtDistance } from '@/lib/utils';

interface Compare { routes: RouteOption[]; provider: 'google' | 'osrm' | 'demo'; simulated: boolean; warnings: string[]; generatedAt: string }

const MODES: { v: TravelMode; label: string; icon: React.ElementType }[] = [{ v: 'walk', label: 'Walk', icon: Footprints }, { v: 'drive', label: 'Cab', icon: Car }, { v: 'transit', label: 'Transit', icon: Bus }];

export function PlanClient() {
  const toast = useToast();
  const { view } = useShell();
  const [origin, setOrigin] = React.useState<Place | null>(null);
  const [destination, setDestination] = React.useState<Place | null>(null);
  const [mode, setMode] = React.useState<TravelMode>('walk');
  const [result, setResult] = React.useState<Compare | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [setup, setSetup] = React.useState(false);
  const [prefill, setPrefill] = React.useState<SetupPrefill | null>(null);
  const [askOpen, setAskOpen] = React.useState(false);

  const compare = React.useCallback(async (o: Place, d: Place, m: TravelMode) => {
    setLoading(true); setError(null); setSetup(false); setSelected(null);
    try {
      const r = await post<Compare>('/api/routes/compare', { origin: o, destination: d, mode: m });
      setResult(r);
    } catch (e) { setError(errMsg(e)); setResult(null); }
    finally { setLoading(false); }
  }, []);

  // Consume a plan handed over by the assistant
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PREFILL_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PREFILL_KEY);
      applyPrefill(JSON.parse(raw));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPrefill(p: { origin: Place | null; destination: Place | null; mode: TravelMode | null; checkinMinutes: number | null; etaMinutes: number | null; shareContactNames: string[] }) {
    const m = p.mode ?? mode;
    if (p.mode) setMode(p.mode);
    if (p.origin) setOrigin(p.origin);
    if (p.destination) setDestination(p.destination);
    setPrefill({ checkinMinutes: p.checkinMinutes, etaMinutes: p.etaMinutes, shareContactNames: p.shareContactNames });
    if (p.origin && p.destination) void compare(p.origin, p.destination, m);
    else toast({ tone: 'info', title: 'Plan prefilled', body: p.origin ? 'Choose a destination to compare routes.' : 'Choose a starting point to compare routes.' });
  }

  const swap = () => { setOrigin(destination); setDestination(origin); };
  const safestId = result?.routes.find((r) => r.safetyTier === 'safest')?.id ?? result?.routes[0]?.id;
  const autoSelectId = selected ?? safestId ?? null;
  const sel = result?.routes.find((r) => r.id === autoSelectId) ?? null;
  const fastest = result?.routes?.length ? result.routes.reduce((a, b) => (a.durationS <= b.durationS ? a : b)).id : undefined;
  const allAssist = sel ? sel.evidence.assist : [];
  const mapRoutes = (result?.routes ?? []).map((r, i) => ({
    id: r.id,
    polyline: r.polyline,
    color: ROUTE_COLORS[i % 3]!,
    selected: selected ? r.id === selected : r.id === autoSelectId,
    label: r.label,
    safetyTier: r.safetyTier,
    safetyLabel: r.safetyLabel,
  }));
  const plan = origin && destination ? { origin, destination, mode } : null;

  return (
    <>
      <PageHeader title="Plan a Safe Route" subtitle="Safety-first route intelligence. We prioritize well-lit, arterial roads and emergency help points over pure travel time." />
      {view && <div className="mb-4 rounded-xl border border-warning/30 bg-warning-soft p-3.5 text-sm text-warning">You already have a journey in progress. End it before starting another.</div>}

      <Card>
        <CardContent className="p-4 sm:p-5">
          <form className="grid items-end gap-3 sm:gap-4 lg:grid-cols-[1fr_auto_1fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); if (origin && destination) void compare(origin, destination, mode); }}>
            <PlaceField id="from" label="From" value={origin} onChange={setOrigin} allowLocate placeholder="Starting point" />
            
            {/* Desktop swap button */}
            <Button type="button" variant="ghost" size="icon" onClick={swap} aria-label="Swap start and destination" className="hidden lg:inline-flex mb-0.5"><ArrowDownUp className="h-4 w-4 lg:rotate-90" /></Button>
            
            {/* Mobile swap button */}
            <div className="flex justify-center -my-1 lg:hidden">
              <Button type="button" variant="outline" size="sm" onClick={swap} aria-label="Swap start and destination" className="h-8 gap-1.5 rounded-full px-3 text-xs shadow-xs text-muted-foreground hover:text-foreground">
                <ArrowDownUp className="h-3.5 w-3.5" />Swap points
              </Button>
            </div>

            <PlaceField id="to" label="To" value={destination} onChange={setDestination} placeholder="Destination" />
            <div>
              <Label htmlFor="mode">Travelling by</Label>
              <div id="mode" role="radiogroup" className="flex h-11 rounded-xl border border-input p-1">
                {MODES.map((m) => (
                  <button
                    key={m.v}
                    type="button"
                    role="radio"
                    aria-checked={mode === m.v}
                    onClick={() => {
                      setMode(m.v);
                      if (origin && destination) {
                        void compare(origin, destination, m.v);
                      }
                    }}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs sm:text-sm font-medium text-muted-foreground transition-colors',
                      mode === m.v && 'bg-primary text-primary-foreground shadow-sm',
                    )}
                  >
                    <m.icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">{m.label}</span>
                    <span className="sm:hidden">{m.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" size="lg" className="h-11 w-full lg:w-auto font-semibold" disabled={!origin || !destination || loading} loading={loading}><Search className="h-4 w-4" />Compare</Button>
          </form>
          {!origin || !destination ? (
            <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Quick test routes:</span>
              <button
                type="button"
                onClick={() => {
                  const o = { name: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167, source: 'osrm' as const };
                  const d = { name: 'India Gate, New Delhi', lat: 28.6129, lng: 77.2295, source: 'osrm' as const };
                  setOrigin(o); setDestination(d); void compare(o, d, mode);
                }}
                className="rounded-full border bg-muted/60 px-3 py-1 font-medium transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary"
              >
                📍 Delhi: CP → India Gate
              </button>
              <button
                type="button"
                onClick={() => {
                  const o = { name: 'MG Road Metro Station, Bengaluru', lat: 12.9756, lng: 77.6068, source: 'osrm' as const };
                  const d = { name: 'Koramangala Sony World Signal, Bengaluru', lat: 12.9345, lng: 77.6116, source: 'osrm' as const };
                  setOrigin(o); setDestination(d); void compare(o, d, mode);
                }}
                className="rounded-full border bg-muted/60 px-3 py-1 font-medium transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary"
              >
                📍 Bengaluru: MG Road → Koramangala
              </button>
              <button
                type="button"
                onClick={() => {
                  const o = { name: 'Marine Drive, Nariman Point, Mumbai', lat: 18.9220, lng: 72.8235, source: 'osrm' as const };
                  const d = { name: 'Bandra Bandstand, Bandra West, Mumbai', lat: 19.0435, lng: 72.8195, source: 'osrm' as const };
                  setOrigin(o); setDestination(d); void compare(o, d, mode);
                }}
                className="rounded-full border bg-muted/60 px-3 py-1 font-medium transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary"
              >
                📍 Mumbai: Marine Drive → Bandra
              </button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-6">
        {error && <ErrorState error={error} onRetry={origin && destination ? () => compare(origin, destination, mode) : undefined} />}
        {loading && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" aria-busy="true"><div className="space-y-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div><Skeleton className="h-96" /></div>
        )}
        {!loading && !error && !result && <EmptyState icon={Search} title="No comparison yet" body="Choose a start and destination to see up to three alternative routes, each with its own evidence strip." />}

        {!loading && result && (
          <>
            {result.simulated ? (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-warning/40 bg-warning-soft p-3.5 text-sm text-warning">
                <SimBadge /><span>Routes and assistance locations below are <strong>simulated for demonstration</strong>. Connect your Google Maps key or ensure internet connectivity for live routing; lighting and visibility come only from dated community reports.</span>
              </div>
            ) : (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-sm text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-2 font-medium">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1877F2] opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1877F2]" />
                  </span>
                  <span>
                    Live Road Routing Active: <strong>{result.provider === 'google' ? 'Google Maps Platform (Live Traffic)' : 'OpenStreetMap Live Worldwide Road Network'}</strong>
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">Routes sorted by safety · lighting · help points · road activity</span>
              </div>
            )}
            {result.warnings.map((w) => <div key={w} className="mb-3 rounded-xl bg-warning-soft p-3 text-sm text-warning">{w}</div>)}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="order-2 space-y-4 lg:order-1 min-w-0 w-full max-w-full">
                {result.routes.map((r, i) => <RouteCard key={r.id} route={r} color={ROUTE_COLORS[i % 3]!} selected={selected === r.id} fastest={r.id === fastest} onSelect={() => { setSelected(r.id); setSetup(false); }} />)}
              </div>
              <div className="order-1 space-y-4 lg:sticky lg:top-6 lg:order-2 lg:self-start min-w-0 w-full max-w-full">
                <SafeMap routes={mapRoutes} origin={origin} destination={destination} assist={allAssist} />
                {sel ? (
                  <Card className="w-full max-w-full overflow-hidden">
                    <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 min-w-0">
                      <div className="min-w-0"><p className="text-sm font-semibold truncate">{sel.label}</p><p className="text-xs text-muted-foreground">{Math.round(sel.durationS / 60)} min · {fmtDistance(sel.distanceM)}</p></div>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setAskOpen(!askOpen)}><Bot className="h-4 w-4" />Ask about routes</Button>
                        <Button size="sm" className="w-full sm:w-auto" disabled={!!view} onClick={() => { setSetup(true); setTimeout(() => document.getElementById('journey-setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }}>Continue to journey setup</Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="w-full max-w-full overflow-hidden"><CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 min-w-0"><p className="text-sm text-muted-foreground">Choose a route to continue.</p><Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setAskOpen(!askOpen)}><Bot className="h-4 w-4" />Ask about routes</Button></CardContent></Card>
                )}
                {askOpen && (
                  <Card className="w-full max-w-full overflow-hidden">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Ask about these routes</CardTitle><CardDescription>Answers use only the evidence shown here.</CardDescription></CardHeader>
                    <CardContent className="min-w-0"><AssistantChat compact plan={plan} suggestions={['Which route has the most recent lighting data?', 'What are the trade-offs between the routes?', 'Where are the gaps in the data?']} /></CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Side-by-side comparison */}
            <Card className="mt-5 w-full max-w-full overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Side by side</CardTitle>
                <span className="text-[11px] text-muted-foreground md:hidden">Scroll table →</span>
              </CardHeader>
              <CardContent className="p-0 sm:p-5 sm:pt-0">
                <div className="overflow-x-auto w-full max-w-full px-3.5 sm:px-0">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-2 pr-4 font-medium">Measure</th>{result.routes.map((r, i) => <th key={r.id} className="py-2 pr-4 font-medium"><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: ROUTE_COLORS[i % 3] }} />{r.label.split(' · ')[0]}</th>)}</tr></thead>
                    <tbody className="divide-y">
                      {([
                        ['Estimated time', (r: RouteOption) => `${Math.round(r.durationS / 60)} min`],
                        ['Distance', (r: RouteOption) => fmtDistance(r.distanceM)],
                        ['Recent evidence (≤30 d)', (r: RouteOption) => `${r.evidence.coverage.freshPct}%`],
                        ['Outdated (>90 d)', (r: RouteOption) => `${r.evidence.coverage.outdatedPct}%`],
                        ['No data', (r: RouteOption) => `${r.evidence.coverage.missingPct}%`],
                        ['Poorly-lit segments reported', (r: RouteOption) => String(r.evidence.lightingPoorSegments)],
                        ['Help points within 250 m', (r: RouteOption) => String(r.evidence.assist.length)],
                        ['Longest gap without one', (r: RouteOption) => `${r.evidence.longestAssistGapKm} km`],
                      ] as [string, (r: RouteOption) => string][]).map(([label, fn]) => <tr key={label}><td className="py-2.5 pr-4 text-muted-foreground">{label}</td>{result.routes.map((r) => <td key={r.id} className="py-2.5 pr-4 font-medium">{fn(r)}</td>)}</tr>)}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 px-3.5 sm:px-0 text-xs text-muted-foreground">There is deliberately no “safety score”. Percentages describe how much of the route has dated observations — not how safe it is.</p>
              </CardContent>
            </Card>

            {sel && <ObservationReport route={sel} onSaved={() => origin && destination && compare(origin, destination, mode)} />}

            {setup && sel && origin && destination && !view && (
              <div className="mt-6"><JourneySetup origin={origin} destination={destination} mode={mode} route={sel} simulatedRoutes={result.simulated} prefill={prefill} /></div>
            )}
          </>
        )}
      </div>
      <Disclaimer className="mt-6" />
    </>
  );
}

/** Community observation: adds a dated, anonymous data point to the evidence for this part of the route. */
function ObservationReport({ route, onSaved }: { route: RouteOption; onSaved: () => void }) {
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState(50);
  const [kind, setKind] = React.useState('lighting');
  const [value, setValue] = React.useState('good');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const total = route.distanceM;

  async function save() {
    const p = pointAlong(route.polyline, (total * pos) / 100);
    setBusy(true);
    try {
      await post('/api/observations', { kind, value, lat: p.lat, lng: p.lng, note: note || undefined });
      toast({ tone: 'success', title: 'Observation added', body: 'It now appears, dated today, in the evidence for this stretch.' });
      setOpen(false); setNote(''); onSaved();
    } catch (e) { toast({ tone: 'error', title: 'Could not save', body: errMsg(e) }); }
    finally { setBusy(false); }
  }

  return (
    <Card className="mt-5">
      <CardHeader className="flex-row items-center justify-between gap-3 pb-2"><div><CardTitle className="text-base">Help keep the evidence current</CardTitle><CardDescription>Seen this stretch recently? Add a dated observation for {route.label.split(' · ')[0]}.</CardDescription></div><Button variant="outline" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Close' : 'Add observation'}</Button></CardHeader>
      {open && (
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="ok">What did you observe?</Label><Select id="ok" value={kind} onChange={(e) => setKind(e.target.value)}><option value="lighting">Street lighting</option><option value="visibility">Visibility / open sightlines</option><option value="activity">People and activity</option></Select></div>
          <div><Label htmlFor="ov">How was it?</Label><Select id="ov" value={value} onChange={(e) => setValue(e.target.value)}><option value="good">Good</option><option value="moderate">Moderate</option><option value="poor">Poor</option></Select></div>
          <div className="sm:col-span-2"><Label htmlFor="op">Where along the route? <span className="font-normal text-muted-foreground">({fmtDistance((total * pos) / 100)} from the start)</span></Label><input id="op" type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="w-full accent-[#1877F2]" /></div>
          <div className="sm:col-span-2"><Label htmlFor="on">Note <span className="font-normal text-muted-foreground">(optional, no personal details)</span></Label><Input id="on" value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="sm:col-span-2"><Button onClick={save} loading={busy}>Save observation</Button></div>
        </CardContent>
      )}
    </Card>
  );
}
