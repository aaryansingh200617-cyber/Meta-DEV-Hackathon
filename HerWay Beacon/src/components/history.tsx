'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock, ChevronRight, Download, History as HistoryIcon, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, ListSkeleton, PageHeader, SimBadge } from '@/components/common';
import { SafeMap, ROUTE_COLORS } from '@/components/map';
import { RelayTracker } from '@/components/relay-tracker';
import { Timeline } from '@/components/timeline';
import { useToast } from '@/components/toast';
import { useShell } from '@/components/app-shell';
import { api, del, errMsg, post } from '@/lib/client/api';
import { usePoll } from '@/hooks/use-poll';
import type { HistoryItem, JourneyView } from '@/lib/client/types';
import { fmtAgo, fmtDateTime, fmtDistance, fmtDuration, fmtTime } from '@/lib/utils';

const END: Record<string, string> = { arrived: 'Arrived', cancelled: 'Cancelled', expired: 'Closed automatically' };

export function HistoryClient() {
  const q = usePoll(() => api<{ journeys: HistoryItem[] }>('/api/journeys'), null);
  return (
    <>
      <PageHeader title="Journey history" subtitle="Your past journeys, check-ins and help requests. You decide how long they’re kept." actions={<Button asChild variant="outline" size="sm"><Link href="/app/settings#retention">Retention settings</Link></Button>} />
      {q.loading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> : !q.data?.journeys.length ? (
        <EmptyState icon={HistoryIcon} title="No journeys yet" body="After you complete a journey it appears here with its full timeline and a record of who had access." action={<Button asChild><Link href="/app/plan">Plan a journey</Link></Button>} />
      ) : (
        <ul className="space-y-3">
          {q.data.journeys.map((j) => (
            <li key={j.id}>
              <Link href={j.status === 'active' ? '/app/journey' : `/app/history/${j.id}`} className="block">
                <Card className="transition-colors hover:bg-surface">
                  <CardContent className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2"><p className="truncate text-sm sm:text-base font-semibold">{j.origin} → {j.destination}</p>{j.simulated && <SimBadge label="Simulated" />}</div>
                      <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{fmtDateTime(j.startedAt)} · {j.mode} · {fmtDistance(j.distanceM)}{j.endedAt ? ` · ${fmtDuration((new Date(j.endedAt).getTime() - new Date(j.startedAt).getTime()) / 1000)}` : ''}</p>
                      <div className="mt-2 flex flex-wrap gap-1 sm:gap-1.5">
                        <Badge variant={j.status === 'active' ? 'teal' : 'neutral'} className="text-[10px] sm:text-xs">{j.status === 'active' ? 'In progress' : END[j.endReason ?? ''] ?? j.status}</Badge>
                        <Badge variant="outline" className="text-[10px] sm:text-xs">{j.counts.confirmed} check-in{j.counts.confirmed === 1 ? '' : 's'}</Badge>
                        {j.counts.missed > 0 && <Badge variant="warning" className="text-[10px] sm:text-xs">{j.counts.missed} missed</Badge>}
                        {j.counts.relays > 0 && <Badge variant="danger" className="text-[10px] sm:text-xs">{j.counts.relays} help request{j.counts.relays === 1 ? '' : 's'}</Badge>}
                        {j.sharedWith.length > 0 && <Badge variant="outline" className="text-[10px] sm:text-xs">Shared with {j.sharedWith.length}</Badge>}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  </CardContent>
                </Card>
              </Link>
              {j.purgeAfter && <p className="mt-1 px-2 text-xs text-muted-foreground"><CalendarClock className="mr-1 inline h-3 w-3" />Auto-deletes {fmtDateTime(j.purgeAfter)}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function HistoryDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useShell();
  const q = usePoll(() => api<{ view: JourneyView }>(`/api/journeys/${id}`), null, [id]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<JourneyView['journey']['summary']>(null);
  React.useEffect(() => { if (q.data) setSummary(q.data.view.journey.summary); }, [q.data]);

  if (q.loading) return <ListSkeleton />;
  if (q.error || !q.data) return <><Button asChild variant="ghost" size="sm" className="mb-4"><Link href="/app/history"><ArrowLeft className="h-4 w-4" />History</Link></Button><ErrorState error={q.error ?? 'Journey not found'} /></>;
  const v = q.data.view;
  const j = v.journey;
  const contacts = [...new Set(v.access.map((a) => a.contactId))].map((cid) => { const gs = v.access.filter((a) => a.contactId === cid); return { cid, name: gs[0]!.contactName, loc: gs.some((g) => g.scope === 'location'), from: gs[0]!.createdAt, to: gs.map((g) => g.revokedAt).filter(Boolean).sort().pop(), reason: gs.find((g) => g.revokedReason)?.revokedReason }; });

  async function remove() {
    if (!confirm('Delete this journey and everything attached to it? This cannot be undone.')) return;
    setBusy('del');
    try { await del(`/api/journeys/${id}`); toast({ tone: 'success', title: 'Journey deleted' }); router.push('/app/history'); } catch (e) { toast({ tone: 'error', title: 'Could not delete', body: errMsg(e) }); setBusy(null); }
  }
  async function summarise() {
    setBusy('sum');
    try { setSummary((await post<{ summary: NonNullable<typeof summary> }>(`/api/journeys/${id}/summary`)).summary); } catch (e) { toast({ tone: 'error', title: 'Could not summarise', body: errMsg(e) }); } finally { setBusy(null); }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3"><Link href="/app/history"><ArrowLeft className="h-4 w-4" />History</Link></Button>
      <PageHeader title={`${j.origin.name} → ${j.destination.name}`} subtitle={`${fmtDateTime(j.startedAt)} · ${j.route.label} · ${fmtDistance(j.route.distanceM)}${j.endedAt ? ` · ${END[j.endReason ?? ''] ?? j.status} ${fmtTime(j.endedAt)}` : ''}`} actions={<Button variant="destructive-outline" size="sm" onClick={remove} loading={busy === 'del'} disabled={j.status === 'active'}><Trash2 className="h-4 w-4" />Delete</Button>} />
      {j.simulated && <div className="mb-4"><SimBadge label="Simulated movement and routes" /></div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
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
            trail={v.trail}
          />
          {v.trailCount === 0 && <p className="-mt-3 text-xs text-muted-foreground">{j.trailPurgedAt ? 'The precise location trail was deleted per your retention settings.' : 'No location trail was recorded for this journey.'}</p>}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Summary</CardTitle><CardDescription>Written only from the event log below.</CardDescription></CardHeader>
            <CardContent>
              {summary ? <><p className="text-sm leading-relaxed">{summary.text}</p><p className="mt-2 text-xs text-muted-foreground">{summary.provider} · {fmtAgo(summary.at)}</p></> : <Button variant="outline" size="sm" onClick={summarise} loading={busy === 'sum'}>Summarise this journey</Button>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Consent receipt</CardTitle><CardDescription>Who could see what, and when it ended.</CardDescription></CardHeader>
            <CardContent>
              {contacts.length === 0 ? <p className="text-sm text-muted-foreground">Nobody had access to this journey.</p> : (
                <ul className="divide-y text-sm">{contacts.map((c) => <li key={c.cid} className="py-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{c.name}</span><Badge variant={c.loc ? 'teal' : 'outline'}>{c.loc ? 'Status + live location' : 'Status only'}</Badge></div><p className="mt-0.5 text-xs text-muted-foreground">{fmtTime(c.from)} → {c.to ? `${fmtTime(c.to)} (${c.reason === 'journey_ended' ? 'revoked when the journey ended' : c.reason === 'expired' ? 'expired' : c.reason === 'user' ? 'withdrawn' : 'revoked'})` : 'still active'}</p></li>)}</ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {v.relays.length > 0 && (
            <Card><CardHeader className="pb-2"><CardTitle>Help requests</CardTitle><CardDescription>Contact statements are reported by them and not verified.</CardDescription></CardHeader>
              <CardContent className="space-y-6">{v.relays.map((r) => <div key={r.id}><p className="mb-2 text-sm font-medium">{r.kind === 'urgent' ? 'Urgent help' : r.kind === 'call_me' ? 'Call request' : 'Automatic alert'} · {fmtTime(r.createdAt)}</p><RelayTracker relay={r} emergencyNumber={user.emergencyNumber} readOnly /></div>)}</CardContent></Card>
          )}
          <Card>
            <CardHeader className="pb-3"><CardTitle>Event timeline</CardTitle><CardDescription>{v.checkinStats.confirmed} check-ins confirmed · {v.checkinStats.missed} missed</CardDescription></CardHeader>
            <CardContent><Timeline events={[...v.events].reverse()} withDate /></CardContent>
          </Card>
          <Button asChild variant="outline" className="w-full"><a href="/api/account/export"><Download className="h-4 w-4" />Export all my data (JSON)</a></Button>
        </div>
      </div>
    </>
  );
}
