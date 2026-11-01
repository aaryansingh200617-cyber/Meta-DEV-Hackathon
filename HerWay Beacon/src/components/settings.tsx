'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, Lock, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FieldHint, Input, Label, Select } from '@/components/ui/input';
import { ToggleRow } from '@/components/ui/switch';
import { ErrorState, ListSkeleton, PageHeader } from '@/components/common';
import { useToast } from '@/components/toast';
import { useShell } from '@/components/app-shell';
import { api, del, errMsg, patch } from '@/lib/client/api';
import { usePoll } from '@/hooks/use-poll';
import type { Status } from '@/lib/client/types';
import type { UserSettings } from '@/lib/types';

export function SettingsClient() {
  const toast = useToast();
  const router = useRouter();
  const { user } = useShell();
  const q = usePoll(() => api<{ settings: UserSettings }>('/api/settings'), null);
  const st = usePoll(() => api<Status>('/api/status'), null);
  const [s, setS] = React.useState<UserSettings | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);
  React.useEffect(() => { if (q.data && !s) setS(q.data.settings); }, [q.data, s]);

  if (q.loading) return <ListSkeleton />;
  if (q.error || !s) return <ErrorState error={q.error ?? 'Settings unavailable'} onRetry={q.refresh} />;
  const set = <K extends keyof UserSettings>(k: K, v: UserSettings[K]) => setS({ ...s, [k]: v });
  const num = (k: keyof UserSettings, mult = 1) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, (Number(e.target.value) * mult) as never);

  async function save() {
    setSaving(true);
    try { await patch('/api/settings', s); toast({ tone: 'success', title: 'Settings saved' }); }
    catch (e) { toast({ tone: 'error', title: 'Could not save', body: errMsg(e) }); }
    finally { setSaving(false); }
  }
  async function deleteAccount() {
    setDeleting(true);
    try { await del('/api/account', { confirm: 'DELETE', password: pw || undefined }); router.push('/'); router.refresh(); }
    catch (e) { toast({ tone: 'error', title: 'Could not delete the account', body: errMsg(e) }); setDeleting(false); }
  }

  return (
    <>
      <PageHeader title="Privacy & settings" subtitle="Defaults for new journeys, how long your data is kept, and full control over your account." actions={<Button onClick={save} loading={saving}>Save changes</Button>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Journey defaults</CardTitle><CardDescription>Applied to new journeys; you can change them per journey.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="s1">Check-in interval</Label><Select id="s1" value={s.defaultCheckinSeconds} onChange={(e) => set('defaultCheckinSeconds', Number(e.target.value))}>{[[0, 'Off'], [300, '5 minutes'], [600, '10 minutes'], [900, '15 minutes'], [1800, '30 minutes']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
              <div><Label htmlFor="s2">Time to respond (minutes)</Label><Input id="s2" type="number" min={1} max={30} value={Math.round(s.checkinWindowSeconds / 60)} onChange={num('checkinWindowSeconds', 60)} /></div>
              <div><Label htmlFor="s3">Missed check-ins before alert</Label><Input id="s3" type="number" min={1} max={10} value={s.maxMissedCheckins} onChange={num('maxMissedCheckins')} /></div>
              <div><Label htmlFor="s4">Grace after ETA (minutes)</Label><Input id="s4" type="number" min={0} max={120} value={s.graceMinutes} onChange={num('graceMinutes')} /></div>
              <div><Label htmlFor="s5">Route deviation threshold (m)</Label><Input id="s5" type="number" min={50} max={2000} step={10} value={s.deviationThresholdM} onChange={num('deviationThresholdM')} /></div>
              <div><Label htmlFor="s6">Time to answer a deviation prompt (s)</Label><Input id="s6" type="number" min={15} max={900} value={s.deviationResponseSeconds} onChange={num('deviationResponseSeconds')} /></div>
              <div><Label htmlFor="s7">Escalate to next circle after (s)</Label><Input id="s7" type="number" min={10} max={1800} value={s.escalateAfterSeconds} onChange={num('escalateAfterSeconds')} /></div>
              <div><Label htmlFor="s8">Emergency number</Label><Input id="s8" type="tel" value={s.emergencyNumber} onChange={(e) => set('emergencyNumber', e.target.value)} /><FieldHint>Shown on “Call” buttons. HerWay Beacon never dials it for you.</FieldHint></div>
            </div>
            <div className="divide-y rounded-xl border px-3.5">
              <ToggleRow id="a1" checked={s.autoAlertOnMissed} onChange={(v) => set('autoAlertOnMissed', v)} title="Alert contacts after missed check-ins" description="Off by default. You can change it for each journey." />
              <ToggleRow id="a2" checked={s.autoAlertOnOverdue} onChange={(v) => set('autoAlertOnOverdue', v)} title="Alert contacts if I haven’t arrived on time" />
              <ToggleRow id="a3" checked={s.autoAlertOnDeviation} onChange={(v) => set('autoAlertOnDeviation', v)} title="Alert contacts if I leave the route and don’t respond" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card id="retention">
            <CardHeader><CardTitle>Data retention</CardTitle><CardDescription>You decide how long journeys are kept. Deletion is automatic.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div><Label htmlFor="r1">Keep finished journeys for</Label><Select id="r1" value={s.retentionDays} onChange={(e) => set('retentionDays', Number(e.target.value))}>{[[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '1 year'], [-1, 'Until I delete them']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select><FieldHint>Applies to timelines, check-ins and help requests of journeys that end from now on.</FieldHint></div>
              <div className="rounded-xl border px-3.5"><ToggleRow id="r2" checked={s.keepTrail} onChange={(v) => set('keepTrail', v)} title="Keep the precise GPS trail" description="Off = the trail is deleted the moment a journey ends. Timelines remain." /></div>
              <p className="flex items-start gap-2 text-xs text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />Contacts never retain your location. Their access ends when the journey ends.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>AI assistant</CardTitle><CardDescription>{st.data?.ai.label ?? '…'}</CardDescription></CardHeader>
            <CardContent><div className="rounded-xl border px-3.5"><ToggleRow id="ai" checked={s.aiEnabled} onChange={(v) => set('aiEnabled', v)} title="Use the AI model for explanations and summaries" description="Only the evidence shown in the app is sent — never your contacts or live location. Off = the built-in rules engine is used. Emergency features never use AI." /></div></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Integrations</CardTitle><CardDescription>What is real in this deployment</CardDescription></CardHeader>
            <CardContent>
              {st.data && <ul className="space-y-2.5 text-sm">{([['Database', st.data.database.label, st.data.database.live], ['Authentication', st.data.auth.label, true], ['Routes & places', st.data.maps.label, st.data.maps.routes === 'google'], ['Map tiles', st.data.maps.tiles === 'google' ? 'Google Maps JavaScript API' : 'Schematic preview (no tiles)', st.data.maps.tiles === 'google'], ['AI', st.data.ai.label, st.data.ai.provider === 'meta'], ['Web Push', st.data.push.label, st.data.push.live], ['SMS / voice', st.data.sms.label, st.data.sms.live], ['Timers', st.data.engine.label, true]] as [string, string, boolean][]).map(([n, l, live]) => <li key={n} className="flex items-start justify-between gap-3"><div><p className="font-medium">{n}</p><p className="text-xs text-muted-foreground">{l}</p></div><Badge variant={live ? 'success' : 'simulated'}>{live ? 'Live' : 'Demo'}</Badge></li>)}</ul>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-5">
        <CardHeader><CardTitle>Your data</CardTitle><CardDescription>Download everything we hold about you, or delete it all.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline"><a href="/api/account/export"><Download className="h-4 w-4" />Export my data (JSON)</a></Button>
          <Button variant="destructive-outline" onClick={() => setDelOpen(true)}><Trash2 className="h-4 w-4" />Delete my account</Button>
        </CardContent>
      </Card>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent title="Delete your account?" description="This permanently deletes your profile, contacts, journeys, location trails, help requests and observations. Every contact link stops working immediately. This can’t be undone.">
          <div><Label htmlFor="dc">Type DELETE to confirm</Label><Input id="dc" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" /></div>
          {!user.demo && <div><Label htmlFor="dp">Password</Label><Input id="dp" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></div>}
          <Button variant="destructive" size="lg" disabled={confirmText !== 'DELETE'} loading={deleting} onClick={deleteAccount}>Permanently delete everything</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
