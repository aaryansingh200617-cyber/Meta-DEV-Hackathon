'use client';
import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, Compass, Radio, ShieldCheck, Users, Cpu, MapPinned, BellRing, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Disclaimer, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/common';
import { useShell } from '@/components/app-shell';
import { api } from '@/lib/client/api';
import { usePoll } from '@/hooks/use-poll';
import type { ContactDTO, HistoryItem, Status } from '@/lib/client/types';
import { fmtAgo, fmtDistance } from '@/lib/utils';

export function DashboardClient() {
  const { view, user } = useShell();
  const contacts = usePoll(() => api<{ contacts: ContactDTO[] }>('/api/contacts'), null);
  const history = usePoll(() => api<{ journeys: HistoryItem[] }>('/api/journeys'), null);
  const status = usePoll(() => api<Status>('/api/status'), null);
  const ready = contacts.data?.contacts.filter((c) => c.status === 'accepted').length ?? 0;
  const pending = contacts.data?.contacts.filter((c) => c.status === 'pending').length ?? 0;
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader title={`${greet}, ${user.name.split(' ')[0]}`} subtitle="Where are you heading today? Compare routes, then choose who follows along." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-4 p-4 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
            {view ? (
              <>
                <div>
                  <Badge variant="blue"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-primary" />Journey in progress</Badge>
                  <p className="mt-3 text-base sm:text-lg font-semibold">{view.journey.origin.name} → {view.journey.destination.name}</p>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{view.journey.route.label} · {view.journey.shared.length} contact{view.journey.shared.length === 1 ? '' : 's'} following</p>
                </div>
                <Button asChild size="lg" className="w-full sm:w-auto"><Link href="/app/journey">Open journey <ArrowRight className="h-4 w-4" /></Link></Button>
              </>
            ) : (
              <>
                <div>
                  <p className="text-base sm:text-lg font-semibold">Plan your next journey</p>
                  <p className="mt-1 max-w-md text-xs sm:text-sm text-muted-foreground">Compare routes by time, distance and dated evidence. Nothing is shared until you start a journey and confirm your pledge.</p>
                </div>
                <Button asChild size="lg" className="w-full sm:w-auto"><Link href="/app/plan"><Compass className="h-4 w-4" />Compare routes</Link></Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Your circle</CardTitle><CardDescription>Contacts who can be notified</CardDescription></CardHeader>
          <CardContent>
            {contacts.loading ? <ListSkeleton rows={1} /> : contacts.error ? <ErrorState error={contacts.error} onRetry={contacts.refresh} /> : (
              <>
                <p className="text-3xl font-semibold">{ready}<span className="ml-1 text-sm font-normal text-muted-foreground">ready</span></p>
                <p className="mt-1 text-sm text-muted-foreground">{pending ? `${pending} invitation${pending === 1 ? '' : 's'} awaiting acceptance` : ready ? 'All invitations accepted' : 'Add someone you trust to get started'}</p>
                <Button asChild variant="outline" size="sm" className="mt-4"><Link href="/app/contacts"><Users className="h-4 w-4" />Manage contacts</Link></Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Recent journeys</CardTitle><Button asChild variant="link" size="sm"><Link href="/app/history">View all</Link></Button></CardHeader>
          <CardContent>
            {history.loading ? <ListSkeleton rows={2} /> : history.error ? <ErrorState error={history.error} onRetry={history.refresh} /> : !history.data?.journeys.length ? (
              <EmptyState icon={Radio} title="No journeys yet" body="Completed journeys, check-ins and help requests will appear here, kept for as long as you choose." action={<Button asChild size="sm"><Link href="/app/plan">Plan a journey</Link></Button>} />
            ) : (
              <ul className="divide-y">
                {history.data.journeys.slice(0, 4).map((j) => (
                  <li key={j.id}>
                    <Link href={`/app/history/${j.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-surface sm:-mx-3 sm:px-3 sm:rounded-xl">
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{j.origin} → {j.destination}</p><p className="text-xs text-muted-foreground">{fmtAgo(j.startedAt)} · {fmtDistance(j.distanceM)}{j.counts.relays ? ` · ${j.counts.relays} help request` : ''}</p></div>
                      <Badge variant={j.status === 'active' ? 'teal' : 'neutral'}>{j.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Integrations</CardTitle><CardDescription>What is live, and what is simulated</CardDescription></CardHeader>
          <CardContent>
            {status.loading ? <ListSkeleton rows={1} /> : status.data && (
              <ul className="space-y-3 text-sm">
                {[
                  [Database, 'Data', status.data.database.label, status.data.database.live],
                  [MapPinned, 'Routes & maps', status.data.maps.label, status.data.maps.routes === 'google' || status.data.maps.routes === 'osrm'],
                  [Cpu, 'AI assistant', status.data.ai.label, status.data.ai.provider === 'meta'],
                  [BellRing, 'Push', status.data.push.label, status.data.push.live],
                  [Bot, 'SMS / voice', status.data.sms.label, status.data.sms.live],
                ].map(([Icon, name, label, live]) => { const I = Icon as React.ElementType; return (
                  <li key={name as string} className="flex items-start gap-3"><I className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /><div className="min-w-0 flex-1"><p className="font-medium">{name as string}</p><p className="text-xs text-muted-foreground">{label as string}</p></div><Badge variant={live ? 'success' : 'simulated'}>{live ? 'Live' : 'Demo'}</Badge></li>
                ); })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="flex items-start gap-3 p-5"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" aria-hidden /><div><p className="font-medium">You are in control</p><p className="mt-1 text-sm text-muted-foreground">Location is shared only with contacts you pick, only while a journey is active, and ends the moment you do.</p></div></CardContent></Card>
        <Card><CardContent className="flex items-start gap-3 p-5"><Bot className="mt-0.5 h-5 w-5 text-primary" aria-hidden /><div><p className="font-medium">Try the assistant</p><p className="mt-1 text-sm text-muted-foreground">“Walk from MG Road Metro to Home, check in every 10 minutes.” <Link href="/app/assistant" className="font-medium text-primary hover:underline">Open assistant</Link></p></div></CardContent></Card>
      </div>
      <Disclaimer className="mt-4" />
    </>
  );
}
