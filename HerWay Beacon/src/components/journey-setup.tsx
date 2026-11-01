'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, FlaskConical, LockKeyhole, Play, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FieldHint, Input, Label, Select } from '@/components/ui/input';
import { Switch, ToggleRow } from '@/components/ui/switch';
import { useToast } from '@/components/toast';
import { useShell } from '@/components/app-shell';
import { api, errMsg, post } from '@/lib/client/api';
import { usePoll } from '@/hooks/use-poll';
import type { ContactDTO } from '@/lib/client/types';
import type { Place, RouteOption, TravelMode, UserSettings } from '@/lib/types';
import { fmtTime } from '@/lib/utils';
import { MAX_OVERRUN_HOURS } from '@/lib/defaults';

export interface SetupPrefill { checkinMinutes?: number | null; etaMinutes?: number | null; shareContactNames?: string[] }

export function JourneySetup({ origin, destination, mode, route, simulatedRoutes, prefill }: { origin: Place; destination: Place; mode: TravelMode; route: RouteOption; simulatedRoutes: boolean; prefill?: SetupPrefill | null }) {
  const router = useRouter();
  const toast = useToast();
  const { user, refresh } = useShell();
  const contactsQ = usePoll(() => api<{ contacts: ContactDTO[] }>('/api/contacts'), null);
  const settingsQ = usePoll(() => api<{ settings: UserSettings }>('/api/settings'), null);
  const contacts = contactsQ.data?.contacts ?? [];
  const s = settingsQ.data?.settings;

  const defaultEta = Math.max(1, Math.ceil(route.durationS / 60) + (mode === 'walk' ? 5 : 8));
  const [eta, setEta] = React.useState(prefill?.etaMinutes ?? defaultEta);
  const [checkin, setCheckin] = React.useState<number | null>(null); // seconds
  const [deviation, setDeviation] = React.useState(true);
  const [autoMissed, setAutoMissed] = React.useState<boolean | null>(null);
  const [autoOverdue, setAutoOverdue] = React.useState<boolean | null>(null);
  const [autoDev, setAutoDev] = React.useState<boolean | null>(null);
  const [emergencyLoc, setEmergencyLoc] = React.useState(false);
  const [status, setStatus] = React.useState<Set<string>>(new Set());
  const [location, setLocation] = React.useState<Set<string>>(new Set());
  const [sim, setSim] = React.useState(simulatedRoutes);
  const [demoTimers, setDemoTimers] = React.useState(false);
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const preApplied = React.useRef(false);

  React.useEffect(() => { setEta(prefill?.etaMinutes ?? defaultEta); }, [route.id, defaultEta, prefill?.etaMinutes]);
  React.useEffect(() => {
    if (s && checkin === null) setCheckin(prefill?.checkinMinutes ? prefill.checkinMinutes * 60 : s.defaultCheckinSeconds);
  }, [s, checkin, prefill?.checkinMinutes]);
  React.useEffect(() => {
    if (preApplied.current || !contacts.length || !prefill?.shareContactNames?.length) return;
    preApplied.current = true;
    const ids = contacts.filter((c) => c.status === 'accepted' && prefill.shareContactNames!.includes(c.name)).map((c) => c.id);
    setStatus(new Set(ids));
  }, [contacts, prefill]);

  const toggle = (set: Set<string>, id: string, on: boolean, fn: (s: Set<string>) => void) => { const n = new Set(set); if (on) n.add(id); else n.delete(id); fn(n); };
  const eff = { missed: autoMissed ?? s?.autoAlertOnMissed ?? false, overdue: autoOverdue ?? s?.autoAlertOnOverdue ?? false, dev: autoDev ?? s?.autoAlertOnDeviation ?? false };
  const sharedNames = contacts.filter((c) => status.has(c.id) || location.has(c.id));
  const locNames = contacts.filter((c) => location.has(c.id)).map((c) => c.name);
  const arrival = new Date(Date.now() + eta * 60_000).toISOString();
  const anyAuto = eff.missed || eff.overdue || eff.dev;

  async function start() {
    setBusy(true);
    try {
      await post('/api/journeys', {
        origin, destination, mode, routeId: route.id, etaMinutes: eta, checkinIntervalS: checkin ?? 0,
        shareContactIds: [...status].filter((id) => !location.has(id)), shareLocationContactIds: [...location],
        escalationShareLocation: emergencyLoc && anyAuto, deviationEnabled: deviation,
        autoAlertOnMissed: eff.missed, autoAlertOnOverdue: eff.overdue, autoAlertOnDeviation: eff.dev,
        simulated: sim, demoTimers, consent: true,
      });
      try { sessionStorage.setItem('sj_gps', sim ? 'sim' : 'device'); } catch { /* ignore */ }
      refresh();
      router.push('/app/journey');
    } catch (e) { toast({ tone: 'error', title: 'Could not start the journey', body: errMsg(e) }); setBusy(false); }
  }

  const options: [number, string][] = [[0, 'Off'], [30, 'Every 30 seconds (demo)'], [300, 'Every 5 minutes'], [600, 'Every 10 minutes'], [900, 'Every 15 minutes'], [1800, 'Every 30 minutes']];
  if (checkin !== null && !options.some(([v]) => v === checkin)) options.splice(1, 0, [checkin, `Every ${Math.round(checkin / 60)} minutes`]);

  return (
    <Card id="journey-setup">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2"><CardTitle className="text-lg">Set up your journey</CardTitle><Badge variant="outline">{route.label}</Badge></div>
        <CardDescription>{origin.name} → {destination.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-7">
        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="eta"><Clock className="mr-1.5 inline h-3.5 w-3.5" />Expected arrival in (minutes)</Label>
            <Input id="eta" type="number" min={1} max={720} value={eta} onChange={(e) => setEta(Math.max(1, Math.min(720, Number(e.target.value) || 1)))} />
            <FieldHint>Arrive by about {fmtTime(arrival)}. Route estimate {Math.round(route.durationS / 60)} min plus a buffer.</FieldHint>
          </div>
          <div>
            <Label htmlFor="checkin">Safety check-ins</Label>
            <Select id="checkin" value={checkin ?? 600} onChange={(e) => setCheckin(Number(e.target.value))}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            <FieldHint>You’ll be asked “Are you okay?” and get {s ? Math.round(s.checkinWindowSeconds / 60 * 10) / 10 : 2} min to respond.</FieldHint>
          </div>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold">Who follows along</h3>
          <p className="mb-3 text-sm text-muted-foreground">Nobody sees anything unless you switch it on here. Location is a separate choice from status.</p>
          {contactsQ.loading ? <p className="text-sm text-muted-foreground">Loading contacts…</p> : contacts.length === 0 ? (
            <p className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">You haven’t added trusted contacts yet. You can still start a journey with check-ins; add contacts from the Contacts page to share it. <a className="font-medium text-primary hover:underline" href="/app/contacts">Add contacts</a></p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {contacts.map((c) => {
                const can = c.status === 'accepted';
                return (
                  <li key={c.id} className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 p-3 sm:p-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.name} <span className="font-normal text-muted-foreground">· {c.relationship || 'Contact'} · Circle {c.tier}</span></p>
                      {!can && <p className="text-xs text-warning">Invitation {c.status} — they must accept before they can follow a journey.</p>}
                    </div>
                    <div className="flex items-center justify-between xs:justify-end gap-4 sm:gap-5 text-sm pt-2 xs:pt-0 border-t xs:border-t-0 border-border/60">
                      <label className="flex items-center gap-2 cursor-pointer"><Switch disabled={!can} checked={status.has(c.id) || location.has(c.id)} onCheckedChange={(v) => { toggle(status, c.id, v, setStatus); if (!v) toggle(location, c.id, false, setLocation); }} aria-label={`Share journey status with ${c.name}`} />Status</label>
                      <label className="flex items-center gap-2 cursor-pointer"><Switch disabled={!can} checked={location.has(c.id)} onCheckedChange={(v) => { toggle(location, c.id, v, setLocation); if (v) toggle(status, c.id, true, setStatus); }} aria-label={`Share live location with ${c.name}`} />Live location</label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold">If something looks wrong</h3>
          <div className="divide-y rounded-xl border px-3.5">
            <ToggleRow id="dev" checked={deviation} onChange={setDeviation} title="Watch for route deviation" description={`If you move more than ${s?.deviationThresholdM ?? 150} m from the route, I’ll ask whether you’re okay. You choose what happens next.`} />
            <ToggleRow id="am" checked={eff.missed} onChange={setAutoMissed} title={`Alert contacts after ${s?.maxMissedCheckins ?? 2} missed check-ins`} description="Off = I only warn you on screen and in the timeline. Contacts are not notified." />
            <ToggleRow id="ao" checked={eff.overdue} onChange={setAutoOverdue} title="Alert contacts if I haven’t arrived on time" description={`${s?.graceMinutes ?? 10} minutes after the expected arrival.`} />
            <ToggleRow id="ad" checked={eff.dev} onChange={setAutoDev} title="Alert contacts if I leave the route and don’t respond" />
            <ToggleRow id="el" checked={emergencyLoc && anyAuto} disabled={!anyAuto} onChange={setEmergencyLoc} title="Pre-authorise location release on automatic alerts" description="If an automatic alert fires, the contacts notified can see my live location until the journey ends. Off = they get the alert without location." />
          </div>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold">Movement source</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {([[false, 'Use my device GPS', 'Real location from this device while the journey is open.'], [true, 'Simulate movement', 'Demonstration: a marker walks along the route so you can test the whole flow.']] as const).map(([v, t, d]) => (
              <label key={String(v)} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                <input type="radio" name="gps" className="mt-1 accent-[#1877F2]" checked={sim === v} onChange={() => setSim(v)} />
                <span><span className="flex items-center gap-1.5 text-sm font-medium">{t}{v && <FlaskConical className="h-3.5 w-3.5 text-warning" aria-hidden />}</span><span className="text-xs text-muted-foreground">{d}</span></span>
              </label>
            ))}
          </div>
          {(simulatedRoutes || user.demo) && (
            <div className="mt-3 rounded-xl border px-3.5">
              <ToggleRow id="dt" checked={demoTimers} onChange={setDemoTimers} title="Demo timers" description="Compress waiting times (20 s check-in window, 20 s escalation, 1 min grace) so you can see escalation in a couple of minutes." />
            </div>
          )}
        </section>

        <section className="rounded-2xl border-2 border-primary/25 bg-primary-soft p-4 sm:p-5" aria-labelledby="pledge">
          <h3 id="pledge" className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden />Your journey pledge</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><LockKeyhole className="mr-1.5 inline h-3.5 w-3.5 text-primary" aria-hidden />Journey status will be visible to: <strong>{sharedNames.length ? sharedNames.map((c) => c.name).join(', ') : 'nobody'}</strong>.</li>
            <li><LockKeyhole className="mr-1.5 inline h-3.5 w-3.5 text-primary" aria-hidden />Live location will be visible to: <strong>{locNames.length ? locNames.join(', ') : 'nobody'}</strong>{emergencyLoc && anyAuto ? ', plus whoever is notified by an automatic alert' : ''}.</li>
            <li><LockKeyhole className="mr-1.5 inline h-3.5 w-3.5 text-primary" aria-hidden />Access <strong>ends automatically</strong> when you end the journey{`, or at the latest ${MAX_OVERRUN_HOURS} hours after your expected arrival`}.</li>
            <li><LockKeyhole className="mr-1.5 inline h-3.5 w-3.5 text-primary" aria-hidden />{checkin ? `Check-ins ${checkin < 60 ? `every ${checkin} s` : `every ${Math.round(checkin / 60)} min`}. ` : 'No check-ins. '}{anyAuto ? 'Automatic alerts: ' + [eff.missed && 'missed check-ins', eff.overdue && 'late arrival', eff.dev && 'unanswered route deviation'].filter(Boolean).join(', ') + '.' : 'Contacts are only notified when you ask for help.'}</li>
            <li><LockKeyhole className="mr-1.5 inline h-3.5 w-3.5 text-primary" aria-hidden />HerWay Beacon does not contact police or emergency services. Call {user.emergencyNumber} yourself if you need to.</li>
          </ul>
          <label className="mt-4 flex items-start gap-3 text-sm font-medium">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#1877F2]" />
            I understand and agree to share only what is listed above.
          </label>
        </section>

        <Button size="lg" className="w-full sm:w-auto" disabled={!agree || checkin === null} loading={busy} onClick={start}><Play className="h-4 w-4" />Start journey</Button>
      </CardContent>
    </Card>
  );
}
