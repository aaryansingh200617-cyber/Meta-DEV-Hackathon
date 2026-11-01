'use client';
import * as React from 'react';
import { MapPin, PhoneCall, Siren } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ToggleRow } from '@/components/ui/switch';
import { RelayTracker } from '@/components/relay-tracker';
import { useToast } from '@/components/toast';
import { api, errMsg, post } from '@/lib/client/api';
import { usePoll } from '@/hooks/use-poll';
import type { ContactDTO, RelayDetail } from '@/lib/client/types';
import { cn } from '@/lib/utils';

/**
 * Relay request sheet. Deliberately free of AI and maps: it only needs this server.
 * The emergency-number button is a plain tel: link that works even if every network call fails.
 */
export function RelayDialog({ open, onOpenChange, journeyActive, emergencyNumber, existingRelayId }: { open: boolean; onOpenChange: (o: boolean) => void; journeyActive: boolean; emergencyNumber: string; existingRelayId?: string | null }) {
  const toast = useToast();
  const [kind, setKind] = React.useState<'call_me' | 'urgent'>('call_me');
  const [mode, setMode] = React.useState<'ripple' | 'all'>('ripple');
  const [loc, setLoc] = React.useState(true);
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [relayId, setRelayId] = React.useState<string | null>(existingRelayId ?? null);
  const [resolving, setResolving] = React.useState(false);

  React.useEffect(() => { if (open) setRelayId(existingRelayId ?? null); }, [open, existingRelayId]);

  const contacts = usePoll(() => api<{ contacts: ContactDTO[] }>('/api/contacts'), null, [open]);
  const eligible = (contacts.data?.contacts ?? []).filter((c) => c.status === 'accepted');
  const relay = usePoll(() => (relayId ? api<{ relay: RelayDetail }>(`/api/relay/${relayId}`) : Promise.resolve(null)), relayId && open ? 2500 : null, [relayId, open]);

  async function send() {
    setBusy(true);
    try {
      const r = await post<{ relay: RelayDetail }>('/api/relay', { kind, mode, includeLocation: journeyActive && loc, message: message || undefined });
      setRelayId(r.relay.id);
      toast({ tone: 'info', title: 'Request sent to your circle', body: 'Watch the tracker below for delivery and acknowledgement.' });
    } catch (e) { toast({ tone: 'error', title: 'Could not send the request', body: `${errMsg(e)} You can still call ${emergencyNumber} directly.` }); }
    finally { setBusy(false); }
  }

  async function resolve() {
    if (!relayId) return;
    setResolving(true);
    try { await post(`/api/relay/${relayId}/resolve`, { reason: 'traveller_safe' }); await relay.refresh(); toast({ tone: 'success', title: 'Request closed' }); }
    catch (e) { toast({ tone: 'error', title: 'Could not close the request', body: errMsg(e) }); }
    finally { setResolving(false); }
  }

  const detail = relay.data && 'relay' in relay.data ? relay.data.relay : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={relayId ? 'Relay' : 'Ask your people for help'} description={relayId ? undefined : 'Your trusted contacts are notified, and you can see who responds.'}>
        {!relayId && (
          <Button asChild variant="destructive" size="lg" className="w-full"><a href={`tel:${emergencyNumber}`}><PhoneCall className="h-5 w-5" />Call {emergencyNumber} now</a></Button>
        )}
        {!relayId && <p className="-mt-2 text-xs text-muted-foreground">HerWay Beacon cannot call emergency services for you. This opens your phone’s dialer.</p>}

        {!relayId ? (
          <>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">What do you need?</legend>
              <div className="grid gap-2 grid-cols-1 xs:grid-cols-2">
                {([['call_me', 'Call me', 'Ask them to phone me now', PhoneCall], ['urgent', 'Urgent help', 'I need help right now', Siren]] as const).map(([k, t, d, Icon]) => (
                  <label key={k} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft', k === 'urgent' && 'has-[:checked]:border-destructive has-[:checked]:bg-destructive-soft')}>
                    <input type="radio" name="kind" className="sr-only" checked={kind === k} onChange={() => setKind(k)} />
                    <Icon className="mt-0.5 h-5 w-5" aria-hidden /><span><span className="block text-sm font-medium">{t}</span><span className="text-xs text-muted-foreground">{d}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <Label htmlFor="relay-msg">Add a note <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="relay-msg" value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Waiting at the metro exit" />
            </div>

            <div className="divide-y rounded-xl border px-3.5">
              <ToggleRow id="relay-loc" checked={journeyActive && loc} disabled={!journeyActive} onChange={setLoc} title="Share my live location with them" description={journeyActive ? 'Only until this journey ends — then access is revoked automatically.' : 'Available during an active journey.'} />
              <ToggleRow id="relay-mode" checked={mode === 'all'} onChange={(v) => setMode(v ? 'all' : 'ripple')} title="Notify everyone at once" description={mode === 'all' ? 'All accepted contacts are notified immediately.' : 'Circle 1 first; if nobody acknowledges in time, the next circle is notified.'} />
            </div>

            <div>
              <p className="eyebrow mb-2">Who can be notified</p>
              {contacts.loading ? <p className="text-sm text-muted-foreground">Loading contacts…</p> : eligible.length === 0 ? (
                <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning">No contact has accepted an invitation yet, so nobody can be notified. Call {emergencyNumber} or someone nearby.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">{eligible.map((c) => <li key={c.id}><Badge variant="outline">Circle {c.tier} · {c.name}</Badge></li>)}</ul>
              )}
            </div>
            <Button size="lg" onClick={send} loading={busy} disabled={eligible.length === 0}>
              {journeyActive && loc && <MapPin className="h-4 w-4" />}Send request
            </Button>
          </>
        ) : detail ? (
          <RelayTracker relay={detail} emergencyNumber={emergencyNumber} onResolve={resolve} resolving={resolving} />
        ) : <p className="text-sm text-muted-foreground">Loading status…</p>}
      </DialogContent>
    </Dialog>
  );
}
