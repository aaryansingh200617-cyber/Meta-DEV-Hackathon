'use client';
import * as React from 'react';
import { AlertTriangle, BellRing, Check, CheckCircle2, Clock, HandHeart, LocateFixed, MapPinOff, PhoneCall, ShieldCheck, ShieldOff, Siren } from 'lucide-react';
import { Wordmark } from '@/components/brand';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ErrorState, ListSkeleton, SimBadge } from '@/components/common';
import { SafeMap, ROUTE_COLORS } from '@/components/map';
import { useToast } from '@/components/toast';
import { api, errMsg, post, del } from '@/lib/client/api';
import { usePoll, useNow } from '@/hooks/use-poll';
import type { ContactDash } from '@/lib/client/types';
import { fmtAgo, fmtClock, fmtDateTime, fmtTime } from '@/lib/utils';

type RelayV = ContactDash['relays'][number];
const ACTIONS = [
  { a: 'calling', label: 'I’m calling her now', icon: PhoneCall },
  { a: 'on_my_way', label: 'I’m on my way', icon: HandHeart },
  { a: 'contacted_authorities', label: 'I’ve contacted the authorities', icon: Siren },
  { a: 'cannot_reach', label: 'I can’t reach her', icon: AlertTriangle },
] as const;
const STATE_LABEL: Record<string, string> = { open: 'Needs a response', acknowledged: 'You acknowledged', resolved: 'Closed by her', unanswered: 'Unanswered', cancelled: 'Cancelled' };

export function ContactDashboardClient({ token }: { token: string }) {
  const q = usePoll(async () => ({ d: await api<ContactDash>(`/api/contact/${token}`), at: Date.now() }), 3000, [token]);
  const toast = useToast();
  const d = q.data?.d;
  const skew = q.data ? new Date(q.data.d.serverNow).getTime() - q.data.at : 0;
  const now = useNow() + skew;
  const [busy, setBusy] = React.useState<string | null>(null);

  async function respond(decision: 'accept' | 'decline') {
    setBusy(decision);
    try { await post(`/api/contact/${token}/respond`, { decision }); await q.refresh(); } catch (e) { toast({ tone: 'error', title: 'Could not save your choice', body: errMsg(e) }); } finally { setBusy(null); }
  }

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b bg-background"><div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-3 sm:px-4"><Wordmark /><Badge variant="outline" className="text-[11px] sm:text-xs shrink-0"><span className="hidden xs:inline">Trusted contact view</span><span className="xs:hidden">Contact view</span></Badge></div></header>
      <main id="main" className="mx-auto max-w-3xl space-y-4 sm:space-y-5 px-3 sm:px-4 py-4 sm:py-6 pb-16">
        {q.loading && !d ? <ListSkeleton /> : q.error && !d ? (
          <Card><CardContent className="p-8 text-center"><ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" /><h1 className="mt-3 text-lg font-semibold">This link isn’t active</h1><p className="mt-1 text-sm text-muted-foreground">{q.error.message}</p></CardContent></Card>
        ) : d && d.contact.status === 'pending' ? (
          <Card>
            <CardContent className="p-6 sm:p-8">
              <ShieldCheck className="h-8 w-8 text-primary" aria-hidden />
              <h1 className="mt-3 text-2xl font-semibold">{d.traveller.firstName} would like you as a trusted contact</h1>
              <p className="mt-2 text-muted-foreground">Hi {d.contact.name.split(' ')[0]}. HerWay Beacon helps {d.traveller.firstName} travel with people she trusts. It’s your choice whether to accept.</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {['When she starts a journey and chooses to share it with you, you’ll see its status — and her live location only if she allows that.', 'If she asks for help, you’ll be notified and can tell her you’re responding.', 'Access ends automatically when each journey ends. You never see her location otherwise.', 'You can step down at any time from this page.', 'HerWay Beacon does not contact police or emergency services. In an emergency you’d need to call your local number yourself.'].map((t) => <li key={t} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{t}</li>)}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3"><Button size="lg" loading={busy === 'accept'} onClick={() => respond('accept')}>Accept</Button><Button size="lg" variant="outline" loading={busy === 'decline'} onClick={() => respond('decline')}>Decline</Button></div>
            </CardContent>
          </Card>
        ) : d ? (
          <Active d={d} token={token} now={now} refresh={q.refresh} onStepDown={() => respond('decline')} />
        ) : null}
        <p className="text-center text-xs text-muted-foreground">HerWay Beacon shows dated information, not safety guarantees, and does not contact emergency services.</p>
      </main>
    </div>
  );
}

function Active({ d, token, now, refresh, onStepDown }: { d: ContactDash; token: string; now: number; refresh: () => Promise<void>; onStepDown: () => void }) {
  const first = d.traveller.firstName;
  const openRelays = d.relays.filter((r) => r.status === 'open' || r.status === 'unanswered' || r.status === 'acknowledged');
  const pastRelays = d.relays.filter((r) => !openRelays.includes(r));
  return (
    <>
      <div><h1 className="text-2xl font-semibold">Following {first}</h1><p className="mt-1 text-sm text-muted-foreground">You’re {first}’s trusted contact{d.contact.relationship ? ` (${d.contact.relationship.toLowerCase()})` : ''}. You only see journeys she shares with you, while they’re active.</p></div>

      {openRelays.map((r) => <RelayCard key={r.id} r={r} token={token} emergencyNumber={d.traveller.emergencyNumber} refresh={refresh} first={first} />)}

      {d.shares.length === 0 && openRelays.length === 0 && (
        <Card><CardContent className="p-8 text-center"><MapPinOff className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">Nothing is being shared with you right now</p><p className="mt-1 text-sm text-muted-foreground">When {first} starts a journey and includes you, it appears here automatically. Keep this page open or enable notifications below.</p></CardContent></Card>
      )}

      {d.shares.map((s) => {
        const left = Math.round((new Date(s.expectedArrivalAt).getTime() - now) / 1000);
        return (
          <Card key={s.journeyId}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2"><Badge variant={s.overdue ? 'danger' : 'teal'}><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-current" />{s.overdue ? 'Past expected arrival' : 'Journey in progress'}</Badge>{s.deviation && <Badge variant="warning">Off planned route</Badge>}{s.location?.simulated && <SimBadge label="Simulated location" />}</div>
              <CardTitle className="mt-2 text-lg">{s.origin} → {s.destination}</CardTitle>
              <CardDescription>{s.routeLabel} · started {fmtTime(s.startedAt)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                <div className="rounded-xl bg-surface p-2 sm:p-3"><p className="text-base sm:text-lg font-semibold tabular-nums">{fmtTime(s.expectedArrivalAt)}</p><p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">arrival{left > 0 ? ` · ${fmtClock(left)}` : ''}</p></div>
                <div className="rounded-xl bg-surface p-2 sm:p-3"><p className="text-base sm:text-lg font-semibold">{s.checkin.enabled ? (s.checkin.awaitingResponse ? 'Awaiting' : s.checkin.lastConfirmedAt ? fmtAgo(s.checkin.lastConfirmedAt, now) : 'None yet') : 'Off'}</p><p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">check-in{s.checkin.missedInARow ? ` · ${s.checkin.missedInARow} missed` : ''}</p></div>
                <div className="rounded-xl bg-surface p-2 sm:p-3"><p className="text-base sm:text-lg font-semibold">{s.location ? fmtAgo(s.location.at, now) : '—'}</p><p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">location update</p></div>
              </div>
              {s.scope.location && s.route ? (
                <SafeMap routes={[{ id: s.journeyId, polyline: s.route.polyline, color: ROUTE_COLORS[1]!, selected: true }]} destination={s.route.destination} position={s.location ? { lat: s.location.lat, lng: s.location.lng, simulated: s.location.simulated } : null} caption={false} />
              ) : (
                <p className="flex items-center gap-2 rounded-xl bg-surface p-3.5 text-sm text-muted-foreground"><MapPinOff className="h-4 w-4 shrink-0" aria-hidden />{first} has shared this journey’s status with you but not her live location.</p>
              )}
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" aria-hidden />Your access ends automatically when {first} ends the journey (cut-off {fmtDateTime(s.accessEndsAt)} at the latest).{s.scope.location && <><LocateFixed className="ml-2 h-3.5 w-3.5" aria-hidden />Location shared with you</>}</p>
            </CardContent>
          </Card>
        );
      })}

      {d.ended.map((e) => (
        <Card key={e.journeyId}><CardContent className="flex items-start gap-3 p-5"><ShieldOff className="mt-0.5 h-5 w-5 text-success" aria-hidden /><div><p className="font-medium">Journey ended — your access has been revoked</p><p className="mt-0.5 text-sm text-muted-foreground">{e.origin} → {e.destination}. Ended {fmtAgo(e.endedAt, now)}. No status or location is available to you any more.</p></div></CardContent></Card>
      ))}

      {pastRelays.length > 0 && (
        <section><h2 className="mb-2 text-sm font-semibold">Earlier requests</h2><ul className="space-y-2">{pastRelays.map((r) => <li key={r.id} className="rounded-xl border bg-background p-3.5 text-sm"><div className="flex justify-between gap-2"><span className="font-medium">{r.headline}</span><span className="text-muted-foreground">{fmtAgo(r.createdAt, now)}</span></div><p className="mt-0.5 text-xs text-muted-foreground">{STATE_LABEL[r.status]}</p></li>)}</ul></section>
      )}

      <PushCard token={token} />
      <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-medium">Step down as trusted contact</p><p className="text-sm text-muted-foreground">Ends your access immediately. {first} will be told.</p></div><Button variant="destructive-outline" onClick={() => { if (confirm(`Step down as ${first}'s trusted contact?`)) onStepDown(); }}>Step down</Button></CardContent></Card>
    </>
  );
}

function RelayCard({ r, token, emergencyNumber, refresh, first }: { r: RelayV; token: string; emergencyNumber: string; refresh: () => Promise<void>; first: string }) {
  const toast = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState('');
  const urgent = r.kind === 'urgent' || r.kind.startsWith('auto');
  async function go(key: string, path: string, body?: unknown) {
    setBusy(key);
    try { await post(`/api/contact/${token}/relays/${r.id}/${path}`, body); await refresh(); } catch (e) { toast({ tone: 'error', title: 'Could not send', body: errMsg(e) }); } finally { setBusy(null); }
  }
  return (
    <Card className={urgent ? 'border-destructive/50 shadow-md' : 'border-primary/40 shadow-md'}>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center gap-2"><Badge variant={urgent ? 'danger' : 'warning'}><BellRing className="h-3 w-3" />{STATE_LABEL[r.status]}</Badge><span className="text-xs text-muted-foreground">{fmtAgo(r.createdAt)}</span>{r.locationVisible && <Badge variant="teal"><LocateFixed className="h-3 w-3" />Location shared with you</Badge>}</div>
        <h2 className="mt-2 text-xl font-semibold">{r.headline}</h2>
        {r.message && <p className="mt-1 text-sm">“{r.message}”</p>}

        {!r.acknowledged ? (
          <Button size="lg" className="mt-4 w-full" loading={busy === 'ack'} onClick={() => go('ack', 'ack')}><CheckCircle2 className="h-5 w-5" />I’ve seen this — acknowledge</Button>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 className="h-4 w-4" />You acknowledged this{r.myActions.length ? '' : '. Let her know what you’re doing:'}</p>
        )}

        <div className="mt-3 grid gap-2 grid-cols-1 xs:grid-cols-2">
          {ACTIONS.map(({ a, label, icon: I }) => {
            const done = r.myActions.some((x) => x.action === a);
            return <Button key={a} variant={done ? 'secondary' : 'outline'} loading={busy === a} onClick={() => go(a, 'action', { action: a, note: note || undefined })}>{done ? <Check className="h-4 w-4" /> : <I className="h-4 w-4" />}{label}</Button>;
          })}
        </div>
        <div className="mt-3"><Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Optional note to include with your response" aria-label="Note" /></div>
        <p className="mt-2 text-xs text-muted-foreground">What you report is shown to {first} as “reported by contact” — HerWay Beacon does not verify it.</p>
        <div className="mt-4 rounded-xl bg-destructive-soft p-3 text-sm"><p>{r.emergencyNote}</p><Button asChild variant="destructive" size="sm" className="mt-2"><a href={`tel:${emergencyNumber}`}><PhoneCall className="h-4 w-4" />Call {emergencyNumber}</a></Button></div>
      </CardContent>
    </Card>
  );
}

function PushCard({ token }: { token: string }) {
  const toast = useToast();
  const [state, setState] = React.useState<'unknown' | 'on' | 'off' | 'unsupported' | 'unconfigured'>('unknown');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setState('unsupported');
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      setState((await reg?.pushManager.getSubscription()) ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const { publicKey } = await api<{ publicKey: string | null }>('/api/push/key');
      if (!publicKey) { setState('unconfigured'); return; }
      if ((await Notification.requestPermission()) !== 'granted') { toast({ tone: 'error', title: 'Notifications are blocked', body: 'Allow them in your browser settings to be alerted when she asks for help.' }); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const pad = '='.repeat((4 - (publicKey.length % 4)) % 4);
      const key = Uint8Array.from(atob((publicKey + pad).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      await post(`/api/contact/${token}/push`, sub.toJSON());
      setState('on'); toast({ tone: 'success', title: 'Notifications enabled on this device' });
    } catch (e) { toast({ tone: 'error', title: 'Could not enable notifications', body: errMsg(e) }); } finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true);
    try { const reg = await navigator.serviceWorker.getRegistration('/sw.js'); await (await reg?.pushManager.getSubscription())?.unsubscribe(); await del(`/api/contact/${token}/push`); setState('off'); } finally { setBusy(false); }
  }
  return (
    <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
      <div className="min-w-0"><p className="flex items-center gap-2 font-medium"><BellRing className="h-4 w-4 text-primary" />Alerts on this device</p><p className="mt-0.5 text-sm text-muted-foreground">{state === 'unsupported' ? 'This browser doesn’t support push notifications. Keep this page open to see requests.' : state === 'unconfigured' ? 'Push isn’t configured on this server yet. Requests appear on this page while it’s open.' : state === 'on' ? 'You’ll be notified when she asks for help.' : 'Get a notification when she asks for help, even if this page is closed.'}</p></div>
      {state === 'off' && <Button onClick={enable} loading={busy}>Enable alerts</Button>}
      {state === 'on' && <Button variant="outline" onClick={disable} loading={busy}>Turn off</Button>}
    </CardContent></Card>
  );
}
