'use client';
import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Compass, Eye, FlaskConical, LifeBuoy, LocateFixed, MapPin, Navigation, Pause, Play, ShieldCheck, ShieldOff, Timer, Undo2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Disclaimer, EmptyState, ErrorState, ListSkeleton, SimBadge } from '@/components/common';
import { SafeMap, ROUTE_COLORS } from '@/components/map';
import { RelayTracker } from '@/components/relay-tracker';
import { Timeline } from '@/components/timeline';
import { useShell } from '@/components/app-shell';
import { useToast } from '@/components/toast';
import { api, errMsg, post } from '@/lib/client/api';
import { usePoll, useNow } from '@/hooks/use-poll';
import { offsetM, pointAlong, polylineLength, projectOnPolyline } from '@/lib/geo';
import type { JourneyView } from '@/lib/client/types';
import { cn, fmtAgo, fmtClock, fmtDateTime, fmtDistance, fmtTime } from '@/lib/utils';

type Fetched = { view: JourneyView | null; at: number };

export function JourneyClient() {
  const { refresh: refreshShell, openHelp, user } = useShell();
  const toast = useToast();
  const q = usePoll<Fetched>(async () => ({ ...(await api<{ view: JourneyView | null }>('/api/journeys/active')), at: Date.now() }), 2500);
  const [ended, setEnded] = React.useState<JourneyView | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [endOpen, setEndOpen] = React.useState(false);
  const [livePos, setLivePos] = React.useState<{ lat: number; lng: number; simulated?: boolean } | null>(null);
  const view = q.data?.view ?? null;
  const skew = q.data && view ? new Date(view.serverNow).getTime() - q.data.at : 0;
  const now = useNow() + skew;

  const act = async (key: string, fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(key);
    try { await fn(); await q.refresh(); if (okMsg) toast({ tone: 'success', title: okMsg }); }
    catch (e) { toast({ tone: 'error', title: 'That didn’t work', body: errMsg(e) }); }
    finally { setBusy(null); }
  };

  if (ended) return <JourneyComplete view={ended} onDone={() => setEnded(null)} />;
  if (q.loading && !q.data) return <ListSkeleton rows={3} />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.refresh} />;
  if (!view) {
    return <EmptyState icon={Compass} title="No journey in progress" body="Start by comparing routes. Nothing is shared with anyone until you start a journey and confirm your pledge." action={<Button asChild><Link href="/app/plan">Plan a journey</Link></Button>} />;
  }

  const j = view.journey;
  const etaMs = new Date(j.expectedArrivalAt).getTime();
  const graceEnd = etaMs + j.graceMinutes * 60_000;
  const left = Math.round((etaMs - now) / 1000);
  const total = polylineLength(j.route.polyline);
  const currentPos = livePos || (j.lastLocation ? { ...j.lastLocation } : null);
  const pr = currentPos ? projectOnPolyline(currentPos, j.route.polyline) : null;
  const progress = pr ? Math.min(100, Math.round((pr.alongM / total) * 100)) : 0;
  const activeRelay = view.relays.find((r) => ['open', 'acknowledged', 'unanswered'].includes(r.status));
  const pending = view.pendingCheckin;
  const dev = j.deviationState === 'prompting';
  const activeAccess = view.access.filter((a) => a.active);
  const overdue = !!j.overdueAt || now > graceEnd;

  return (
    <>
      <div className="mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2"><Badge variant={overdue ? 'danger' : 'teal'}><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-current" />{overdue ? 'Past expected arrival' : 'Journey in progress'}</Badge>{j.simulated && <SimBadge label="Simulated movement" />}</div>
          <h1 className="mt-2 text-xl sm:text-2xl font-semibold">{j.origin.name} → {j.destination.name}</h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{j.route.label} · {fmtDistance(j.route.distanceM)} · started {fmtTime(j.startedAt)}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="destructive" size="lg" className="flex-1 sm:flex-initial" onClick={openHelp}><LifeBuoy className="h-5 w-5" />Ask for help</Button>
          <Button variant="outline" size="lg" className="flex-1 sm:flex-initial" onClick={() => setEndOpen(true)}>End journey</Button>
        </div>
      </div>

      {/* Attention banners */}
      <div className="mb-5 space-y-3" aria-live="polite">
        {dev && (
          <Card className="border-warning/50 bg-warning-soft">
            <CardContent className="p-4">
              <p className="flex items-center gap-2 font-semibold text-warning"><Navigation className="h-4 w-4" />You seem to have left your route</p>
              <p className="mt-1 text-sm">Are you okay? {j.deviationPromptExpiresAt && <>If you don’t respond{j.autoAlertOnDeviation ? ', your contacts will be alerted' : ', this is logged'} in <strong>{fmtClock(Math.max(0, (new Date(j.deviationPromptExpiresAt).getTime() - now) / 1000))}</strong>.</>}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" loading={busy === 'd1'} onClick={() => act('d1', () => post(`/api/journeys/${j.id}/deviation`, { response: 'ok' }), 'Noted — you’re okay')}>I’m okay — different path</Button>
                <Button size="sm" variant="outline" loading={busy === 'd2'} onClick={() => act('d2', () => post(`/api/journeys/${j.id}/deviation`, { response: 'snooze' }), 'Paused for 15 minutes')}>Pause prompts 15 min</Button>
                <Button size="sm" variant="destructive-outline" loading={busy === 'd3'} onClick={() => act('d3', () => post(`/api/journeys/${j.id}/deviation`, { response: 'alert' }))}>Alert my contacts</Button>
              </div>
            </CardContent>
          </Card>
        )}
        {j.deviationState === 'unanswered' && <Card className="border-warning/40"><CardContent className="p-4 text-sm"><strong>Route-deviation prompt unanswered.</strong> Automatic alerts are off, so nobody was notified. <button className="font-medium text-primary underline" onClick={() => act('d1', () => post(`/api/journeys/${j.id}/deviation`, { response: 'ok' }))}>I’m okay</button></CardContent></Card>}
        {overdue && (
          <Card className="border-destructive/40 bg-destructive-soft">
            <CardContent className="p-4">
              <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />You’re past your expected arrival</p>
              <p className="mt-1 text-sm">{j.autoAlertOnOverdue ? 'Your contacts have been alerted as you chose. ' : 'Contacts have not been notified automatically. '}Still travelling? Extend your time, or end the journey if you’ve arrived.</p>
              <div className="mt-3 flex flex-wrap gap-2">{[15, 30].map((m) => <Button key={m} size="sm" variant="outline" loading={busy === `e${m}`} onClick={() => act(`e${m}`, () => post(`/api/journeys/${j.id}/extend`, { minutes: m }), `Extended by ${m} minutes`)}>+{m} min</Button>)}<Button size="sm" onClick={() => setEndOpen(true)}>I’ve arrived</Button></div>
            </CardContent>
          </Card>
        )}
        {j.arrivalSuggested && !overdue && (
          <Card className="border-primary/40 bg-primary-soft"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="flex items-center gap-2 text-sm font-medium"><MapPin className="h-4 w-4 text-primary" />You look close to {j.destination.name}.</p><Button size="sm" onClick={() => setEndOpen(true)}>I’ve arrived — end journey</Button></CardContent></Card>
        )}
        {pending && (
          <Card className="border-primary/50 shadow-md">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-lg font-semibold">Are you okay?</p><Badge variant="warning"><Timer className="h-3 w-3" />{fmtClock(Math.max(0, (new Date(pending.windowEndsAt).getTime() - now) / 1000))} to respond</Badge></div>
              <p className="mt-1 text-sm text-muted-foreground">Safety check-in. {j.autoAlertOnMissed ? `After ${j.maxMissed} missed in a row your contacts are alerted.` : 'Missed check-ins are logged only.'}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button size="lg" loading={busy === 'ci'} onClick={() => act('ci', () => post(`/api/journeys/${j.id}/checkin`, { response: 'ok' }), 'Check-in confirmed')}><CheckCircle2 className="h-5 w-5" />I’m okay</Button>
                <Button size="lg" variant="destructive-outline" loading={busy === 'ch'} onClick={() => act('ch', () => post(`/api/journeys/${j.id}/checkin`, { response: 'need_help' }), 'Your circle has been notified')}><LifeBuoy className="h-5 w-5" />I need help</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <SafeMap
            routes={[{
              id: j.route.id,
              polyline: j.route.polyline,
              color: j.route.safetyTier === 'safest' ? '#059669' : ROUTE_COLORS[1]!,
              selected: true,
              safetyTier: j.route.safetyTier,
              safetyLabel: j.route.safetyLabel,
            }]}
            origin={j.origin}
            destination={j.destination}
            position={currentPos}
            trail={view.trail}
            assist={j.route.evidence.assist}
          />
          <Card>
            <CardContent className="grid grid-cols-3 gap-2 sm:gap-4 p-3.5 sm:p-5 text-center">
              <div><p className="text-xl sm:text-2xl font-semibold tabular-nums">{left > 0 ? fmtClock(left) : '0:00'}</p><p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">to arrival ({fmtTime(j.expectedArrivalAt)})</p></div>
              <div><p className="text-xl sm:text-2xl font-semibold tabular-nums">{pr ? `${progress}%` : '—'}</p><p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{pr ? 'along route' : 'waiting GPS'}</p></div>
              <div><p className="text-xl sm:text-2xl font-semibold tabular-nums">{j.checkinIntervalS ? (j.nextCheckinDueAt && !pending ? fmtClock(Math.max(0, (new Date(j.nextCheckinDueAt).getTime() - now) / 1000)) : pending ? 'Now' : '—') : 'Off'}</p><p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">next check-in</p></div>
            </CardContent>
            <div className="px-3.5 pb-4 sm:px-5 sm:pb-5"><div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Route progress"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div></div>
          </Card>
          <LocationFeed journeyId={j.id} simulated={j.simulated} route={j.route.polyline} progressNow={pr ? pr.alongM / total : 0} last={j.lastLocation} onLivePosition={setLivePos} onAttentionTrigger={q.refresh} onError={(m) => toast({ tone: 'error', title: 'Location', body: m })} />
        </div>

        <div className="space-y-5">
          {activeRelay ? (
            <Card className="border-destructive/30">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-destructive" />HerWay Beacon Relay</CardTitle><CardDescription>{activeRelay.message || (activeRelay.kind === 'urgent' ? 'Urgent help requested' : activeRelay.kind.startsWith('auto') ? 'Automatic alert' : 'Call requested')} · {fmtAgo(activeRelay.createdAt, now)}</CardDescription></CardHeader>
              <CardContent><RelayTracker relay={activeRelay} emergencyNumber={user.emergencyNumber} resolving={busy === 'res'} onResolve={() => act('res', () => post(`/api/relay/${activeRelay.id}/resolve`, { reason: 'traveller_safe' }), 'Request closed')} /></CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-primary" />HerWay Beacon Relay</CardTitle><CardDescription>No open requests. One tap reaches your circle.</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap gap-2"><Button variant="destructive" onClick={openHelp}>Ask for help</Button><Button asChild variant="outline"><a href={`tel:${user.emergencyNumber}`}>Call {user.emergencyNumber}</a></Button></CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" />Who can see this journey</CardTitle><CardDescription>Access ends automatically when you end the journey.</CardDescription></CardHeader>
            <CardContent>
              {activeAccess.length === 0 ? <p className="rounded-xl bg-surface p-3 text-sm text-muted-foreground">Nobody is following this journey. Only you can see your location.</p> : (
                <ul className="divide-y">
                  {[...new Set(activeAccess.map((a) => a.contactId))].map((cid) => {
                    const gs = activeAccess.filter((a) => a.contactId === cid);
                    const loc = gs.some((g) => g.scope === 'location');
                    return <li key={cid} className="flex items-center justify-between gap-3 py-2.5"><div><p className="text-sm font-medium">{gs[0]!.contactName}</p><p className="text-xs text-muted-foreground">Expires {fmtDateTime(gs[0]!.expiresAt)} at the latest</p></div><div className="flex gap-1.5"><Badge variant="outline">Status</Badge>{loc ? <Badge variant="teal"><LocateFixed className="h-3 w-3" />Location</Badge> : <Badge variant="outline">No location</Badge>}</div></li>;
                  })}
                </ul>
              )}
              {view.checkinStats.confirmed + view.checkinStats.missed > 0 && <p className="mt-3 text-xs text-muted-foreground">Check-ins: {view.checkinStats.confirmed} confirmed, {view.checkinStats.missed} missed.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle>Live timeline</CardTitle></CardHeader>
            <CardContent><Timeline events={view.events} limit={8} /></CardContent>
          </Card>
        </div>
      </div>
      <Disclaimer className="mt-6" />

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent title="End this journey?" description="Ending a journey immediately revokes everyone’s access.">
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2"><ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Access ends for {[...new Set(activeAccess.map((a) => a.contactId))].length} contact(s). They will no longer see status or location.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{activeRelay ? 'Open help requests will be closed.' : 'No help requests are open.'}</li>
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button size="lg" loading={busy === 'end'} onClick={async () => { setBusy('end'); try { const r = await post<{ view: JourneyView }>(`/api/journeys/${j.id}/end`, { reason: 'arrived' }); setEnded(r.view); setEndOpen(false); refreshShell(); } catch (e) { toast({ tone: 'error', title: 'Could not end the journey', body: errMsg(e) }); } finally { setBusy(null); } }}><CheckCircle2 className="h-5 w-5" />I’ve arrived safely</Button>
            <Button size="lg" variant="outline" loading={busy === 'cancel'} onClick={async () => { setBusy('cancel'); try { const r = await post<{ view: JourneyView }>(`/api/journeys/${j.id}/end`, { reason: 'cancelled' }); setEnded(r.view); setEndOpen(false); refreshShell(); } catch (e) { toast({ tone: 'error', title: 'Could not cancel', body: errMsg(e) }); } finally { setBusy(null); } }}>Cancel journey</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ───────────── Location source: simulated walker or device GPS ───────────── */

function LocationFeed({
  journeyId,
  simulated,
  route,
  progressNow,
  last,
  onLivePosition,
  onAttentionTrigger,
  onError,
}: {
  journeyId: string;
  simulated: boolean;
  route: [number, number][];
  progressNow: number;
  last: JourneyView['journey']['lastLocation'];
  onLivePosition?: (p: { lat: number; lng: number; simulated?: boolean }) => void;
  onAttentionTrigger?: () => void;
  onError: (m: string) => void;
}) {
  const [running, setRunning] = React.useState(true);
  const [speed, setSpeed] = React.useState(1);
  const [off, setOff] = React.useState(false);
  const [gps, setGps] = React.useState<'idle' | 'ok' | 'denied' | 'unsupported'>('idle');
  const total = React.useMemo(() => polylineLength(route), [route]);
  const prog = React.useRef(progressNow);
  const first = React.useRef(true);
  const lastGps = React.useRef(0);
  const state = React.useRef({ running, speed, off });
  state.current = { running, speed, off };
  React.useEffect(() => { if (first.current && progressNow > 0) { prog.current = progressNow; first.current = false; } }, [progressNow]);

  // Simulated walker: Smooth movement ticks. Full route takes ~60 s at 1× so the whole flow can be demoed.
  React.useEffect(() => {
    if (!simulated) return;
    const send = async () => {
      const s = state.current;
      if (!s.running && !first.current) return;
      first.current = false;
      if (s.running) prog.current = Math.min(1, prog.current + 0.0333 * s.speed);
      let p = pointAlong(route, total * prog.current);
      if (s.off) p = offsetM(p, 420, 0);

      // Instantly update live position on map without waiting for server response
      onLivePosition?.({ lat: p.lat, lng: p.lng, simulated: true });

      try {
        const res = await post<{ ok: boolean; deviationState?: string; arrivalSuggested?: boolean }>(
          `/api/journeys/${journeyId}/location`,
          { lat: p.lat, lng: p.lng, accuracy: 8, simulated: true }
        );
        if (res.deviationState === 'prompting' || res.arrivalSuggested) {
          onAttentionTrigger?.();
        }
      } catch (e) {
        if ((e as Error).message && !/ended/i.test((e as Error).message)) onError((e as Error).message);
      }
    };
    void send();
    const id = setInterval(send, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulated, journeyId, route, total]);

  // Device GPS: Live movement updates like Google Maps
  React.useEffect(() => {
    if (simulated) return;
    if (!navigator.geolocation) { setGps('unsupported'); return; }
    const id = navigator.geolocation.watchPosition(
      async (p) => {
        setGps('ok');
        // Instantly reflect current position on the map
        onLivePosition?.({ lat: p.coords.latitude, lng: p.coords.longitude, simulated: false });

        // Throttle backend server sync to every 2.5 seconds
        if (Date.now() - lastGps.current < 2500) return;
        lastGps.current = Date.now();
        try {
          const res = await post<{ ok: boolean; deviationState?: string; arrivalSuggested?: boolean }>(
            `/api/journeys/${journeyId}/location`,
            { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, simulated: false }
          );
          if (res.deviationState === 'prompting' || res.arrivalSuggested) {
            onAttentionTrigger?.();
          }
        } catch { /* transient */ }
      },
      () => setGps('denied'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [simulated, journeyId, onLivePosition, onAttentionTrigger]);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base">{simulated ? <><FlaskConical className="h-4 w-4 text-warning" />Movement simulator</> : <><LocateFixed className="h-4 w-4 text-primary" />Device location</>}</CardTitle>
        <CardDescription>{simulated ? 'Demonstration only — a marker moves along your route so you can test check-ins, deviation and help requests.' : 'Your device location is sent while this page is open. Backend timers keep running even if you close it.'}</CardDescription></CardHeader>
      <CardContent>
        {simulated ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setRunning(!running)}>{running ? <><Pause className="h-4 w-4" />Pause</> : <><Play className="h-4 w-4" />Resume</>}</Button>
            {[1, 3].map((s) => <Button key={s} size="sm" variant={speed === s ? 'default' : 'outline'} onClick={() => setSpeed(s)}>{s}×</Button>)}
            <Button size="sm" variant={off ? 'default' : 'destructive-outline'} onClick={() => setOff(!off)}>{off ? <><Undo2 className="h-4 w-4" />Return to route</> : <><Navigation className="h-4 w-4" />Leave the route</>}</Button>
            <span className="text-xs text-muted-foreground">Last update {last ? fmtAgo(last.at) : 'pending'}</span>
          </div>
        ) : (
          <p className="text-sm">{gps === 'ok' ? <>Receiving GPS · last update {last ? fmtAgo(last.at) : 'pending'}</> : gps === 'denied' ? <span className="text-destructive">Location permission was denied. Allow it in your browser settings so contacts you authorised can follow along.</span> : gps === 'unsupported' ? <span className="text-destructive">This device doesn’t support location.</span> : 'Waiting for permission…'}</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────── After the journey ends ───────────── */

function JourneyComplete({ view, onDone }: { view: JourneyView; onDone: () => void }) {
  const toast = useToast();
  const j = view.journey;
  const [summary, setSummary] = React.useState(j.summary);
  const [busy, setBusy] = React.useState(false);
  const contacts = [...new Set(view.access.map((a) => a.contactId))].map((cid) => { const gs = view.access.filter((a) => a.contactId === cid); return { name: gs[0]!.contactName, scopes: gs.map((g) => g.scope), at: gs.map((g) => g.revokedAt).filter(Boolean).sort().pop() }; });
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 className="h-6 w-6" /></div>
          <h1 className="mt-4 text-2xl font-semibold">{j.endReason === 'arrived' ? 'You’ve arrived' : 'Journey cancelled'}</h1>
          <p className="mt-1 text-muted-foreground">{j.origin.name} → {j.destination.name} · {fmtTime(j.startedAt)}–{fmtTime(j.endedAt)}</p>

          <div className="mt-6 rounded-2xl border bg-surface p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><ShieldOff className="h-4 w-4 text-success" />Access receipt</p>
            <p className="mt-1 text-sm text-muted-foreground">Live location is no longer visible to anyone but you.</p>
            {contacts.length === 0 ? <p className="mt-3 text-sm">Nobody had access to this journey.</p> : (
              <ul className="mt-3 divide-y text-sm">{contacts.map((c) => <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="font-medium">{c.name}</span><span className="text-muted-foreground">{c.scopes.includes('location') ? 'Status + location' : 'Status only'} · ended {fmtTime(c.at ?? j.endedAt)}</span></li>)}</ul>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[[view.checkinStats.confirmed, 'check-ins confirmed'], [view.checkinStats.missed, 'missed'], [view.relays.length, 'help requests']].map(([n, l]) => <div key={l as string} className="rounded-xl border p-3"><p className="text-xl font-semibold">{n}</p><p className="text-xs text-muted-foreground">{l}</p></div>)}
          </div>

          <div className="mt-5">
            {summary ? (
              <div className="rounded-2xl bg-primary-soft p-4 text-sm"><p className="font-medium">Summary</p><p className="mt-1">{summary.text}</p><p className="mt-2 text-xs text-muted-foreground">Generated by {summary.provider} from your event log only.</p></div>
            ) : (
              <Button variant="outline" loading={busy} onClick={async () => { setBusy(true); try { const r = await post<{ summary: NonNullable<typeof summary> }>(`/api/journeys/${j.id}/summary`); setSummary(r.summary); } catch (e) { toast({ tone: 'error', title: 'Could not summarise', body: errMsg(e) }); } finally { setBusy(false); } }}>Summarise this journey</Button>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-2"><Button asChild><Link href={`/app/history/${j.id}`}>View timeline</Link></Button><Button variant="outline" onClick={onDone}>Done</Button><Button asChild variant="ghost"><Link href="/app/plan">Plan another</Link></Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
