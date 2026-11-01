'use client';
import * as React from 'react';
import { BellRing, CheckCheck, CircleDashed, FlaskConical, PhoneCall, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { RelayDetail } from '@/lib/client/types';
import { useNow } from '@/hooks/use-poll';
import { fmtAgo, fmtClock, fmtTime } from '@/lib/utils';

const CHANNEL: Record<string, string> = { in_app: 'In-app', web_push: 'Push', sms_sim: 'SMS / call' };
const ACTION: Record<string, string> = { calling: 'Says they are calling you', on_my_way: 'Says they are on their way', contacted_authorities: 'Says they contacted the authorities', cannot_reach: 'Could not reach you', note: 'Sent a note' };

function chip(status: string): { v: 'neutral' | 'teal' | 'success' | 'warning' | 'danger' | 'simulated'; t: string } {
  switch (status) {
    case 'acknowledged': return { v: 'success', t: 'Acknowledged' };
    case 'delivered': return { v: 'teal', t: 'Delivered' };
    case 'sent': return { v: 'neutral', t: 'Sent' };
    case 'simulated': return { v: 'simulated', t: 'Simulated — not sent' };
    case 'failed': return { v: 'danger', t: 'Failed' };
    case 'skipped': return { v: 'neutral', t: 'Not available' };
    default: return { v: 'neutral', t: 'Queued' };
  }
}

export function RelayTracker({ relay, emergencyNumber, onResolve, resolving, readOnly }: { relay: RelayDetail; emergencyNumber?: string; onResolve?: () => void; resolving?: boolean; readOnly?: boolean }) {
  const now = useNow();
  const open = relay.status === 'open';
  const nextAt = new Date(relay.lastStepAt).getTime() + relay.escalateAfterS * 1000;
  const remaining = Math.max(0, Math.round((nextAt - now) / 1000));
  const lastStep = relay.step >= relay.groups.length - 1;

  const banner =
    relay.status === 'acknowledged' ? { tone: 'bg-success-soft text-success', icon: CheckCheck, title: 'A trusted contact has acknowledged', body: 'They have seen your request. What they report doing is shown below and is not verified by HerWay Beacon.' }
    : relay.status === 'unanswered' ? { tone: 'bg-destructive-soft text-destructive', icon: ShieldAlert, title: 'No one has acknowledged yet', body: `HerWay Beacon has not contacted emergency services. If you need help now, call ${emergencyNumber ?? '112'} or reach someone nearby.` }
    : relay.status === 'resolved' ? { tone: 'bg-muted text-foreground', icon: CheckCheck, title: 'Request closed', body: 'Closed after you marked yourself safe or ended the journey.' }
    : relay.status === 'cancelled' ? { tone: 'bg-muted text-foreground', icon: CircleDashed, title: 'Request cancelled', body: '' }
    : { tone: 'bg-warning-soft text-warning', icon: BellRing, title: 'Waiting for acknowledgement', body: lastStep ? `No further circles to escalate to. Consider calling ${emergencyNumber ?? '112'}.` : `If nobody responds, the next circle is notified automatically in ${fmtClock(remaining)}.` };
  const Icon = banner.icon;

  return (
    <div className="space-y-4">
      <div className={`flex items-start gap-3 rounded-xl p-3.5 ${banner.tone}`} role="status">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="text-sm"><p className="font-medium">{banner.title}</p>{banner.body && <p className="mt-0.5 opacity-90">{banner.body}</p>}</div>
      </div>

      {(relay.status === 'open' || relay.status === 'unanswered') && emergencyNumber && (
        <Button asChild variant="destructive-outline" className="w-full"><a href={`tel:${emergencyNumber}`}><PhoneCall className="h-4 w-4" />Call {emergencyNumber} yourself</a></Button>
      )}

      <ol className="space-y-3">
        {relay.groups.map((_, step) => {
          const members = relay.contacts.filter((c) => c.step === step);
          const reached = step <= relay.step;
          return (
            <li key={step} className={reached ? '' : 'opacity-55'}>
              <p className="eyebrow mb-1.5">Circle {step + 1}{!reached && ' · not yet notified'}</p>
              <div className="space-y-2">
                {members.map((c) => (
                  <div key={c.contactId} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.acknowledgedAt ? <Badge variant="success">Acknowledged {fmtTime(c.acknowledgedAt)}</Badge> : <Badge variant={c.notified ? 'warning' : 'outline'}>{c.notified ? 'Awaiting acknowledgement' : 'Not notified'}</Badge>}
                    </div>
                    {c.channels.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {c.channels.map((ch) => { const k = chip(ch.status); return (
                          <li key={ch.channel}><Badge variant={k.v} title={ch.detail ?? undefined}>{ch.status === 'simulated' && <FlaskConical className="h-3 w-3" aria-hidden />}{CHANNEL[ch.channel]}: {k.t}</Badge></li>
                        ); })}
                      </ul>
                    )}
                    {relay.actions.filter((a) => a.contactId === c.contactId).map((a) => (
                      <p key={a.id} className="mt-2 text-sm text-muted-foreground">
                        <span className="text-foreground">{ACTION[a.action]}</span>{a.note ? ` — “${a.note}”` : ''} · {fmtAgo(a.at)} <span className="text-xs">(reported by contact, not verified)</span>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      {!readOnly && (open || relay.status === 'acknowledged' || relay.status === 'unanswered') && onResolve && (
        <Button variant="outline" className="w-full" onClick={onResolve} loading={resolving}>I’m safe — close this request</Button>
      )}
    </div>
  );
}
