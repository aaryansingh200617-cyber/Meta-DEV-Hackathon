import { AlertTriangle, BellRing, CheckCircle2, Clock, Flag, KeyRound, MapPin, Navigation, ShieldOff, Sparkles, UserCheck } from 'lucide-react';
import type { JourneyEvent } from '@/lib/types';
import { cn, fmtDateTime, fmtTime } from '@/lib/utils';

const ICON: Partial<Record<JourneyEvent['type'], { i: React.ElementType; c: string }>> = {
  journey_started: { i: Flag, c: 'text-primary' }, access_granted: { i: KeyRound, c: 'text-primary' }, access_revoked: { i: ShieldOff, c: 'text-success' },
  checkin_prompted: { i: Clock, c: 'text-muted-foreground' }, checkin_confirmed: { i: CheckCircle2, c: 'text-success' }, checkin_missed: { i: AlertTriangle, c: 'text-warning' }, missed_threshold: { i: AlertTriangle, c: 'text-warning' },
  deviation_detected: { i: Navigation, c: 'text-warning' }, deviation_resolved: { i: Navigation, c: 'text-success' }, deviation_response: { i: Navigation, c: 'text-muted-foreground' }, deviation_unanswered: { i: Navigation, c: 'text-warning' },
  overdue: { i: AlertTriangle, c: 'text-destructive' }, eta_extended: { i: Clock, c: 'text-muted-foreground' }, arrival_suggested: { i: MapPin, c: 'text-primary' },
  relay_requested: { i: BellRing, c: 'text-destructive' }, relay_sent: { i: BellRing, c: 'text-muted-foreground' }, relay_delivered: { i: BellRing, c: 'text-primary' }, relay_acknowledged: { i: UserCheck, c: 'text-success' }, relay_action: { i: UserCheck, c: 'text-success' },
  relay_escalated: { i: BellRing, c: 'text-warning' }, relay_unanswered: { i: AlertTriangle, c: 'text-destructive' }, relay_resolved: { i: CheckCircle2, c: 'text-muted-foreground' },
  journey_ended: { i: Flag, c: 'text-primary' }, location_trail_deleted: { i: ShieldOff, c: 'text-muted-foreground' }, ai_summary: { i: Sparkles, c: 'text-primary' },
};

export function Timeline({ events, limit, withDate }: { events: JourneyEvent[]; limit?: number; withDate?: boolean }) {
  const list = (limit ? events.slice(0, limit) : events);
  if (!list.length) return <p className="text-sm text-muted-foreground">No events yet.</p>;
  return (
    <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
      {list.map((e) => {
        const m = ICON[e.type] ?? { i: Clock, c: 'text-muted-foreground' };
        const I = m.i;
        return (
          <li key={e.id} className="relative flex gap-3">
            <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-background"><I className={cn('h-4 w-4', m.c)} aria-hidden /></span>
            <div className="min-w-0 pt-1"><p className="text-sm leading-snug">{e.message}</p><p className="mt-0.5 text-xs text-muted-foreground">{withDate ? fmtDateTime(e.at) : fmtTime(e.at)} · {e.actor === 'system' ? 'HerWay' : e.actor === 'contact' ? 'Contact' : 'You'}</p></div>
          </li>
        );
      })}
    </ol>
  );
}
