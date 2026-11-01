'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bot, Compass, History, Home, LifeBuoy, LogOut, MoreHorizontal, Settings, Users, Radio } from 'lucide-react';
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { RelayDialog } from '@/components/relay-dialog';
import { api, post } from '@/lib/client/api';
import { usePoll, useNow } from '@/hooks/use-poll';
import type { JourneyView } from '@/lib/client/types';
import { cn, fmtClock, fmtTime, initials } from '@/lib/utils';

interface ShellUser { name: string; email: string; demo: boolean; emergencyNumber: string }

const Ctx = React.createContext<{ view: JourneyView | null; refresh: () => void; user: ShellUser; openHelp: () => void }>({ view: null, refresh: () => undefined, user: { name: '', email: '', demo: false, emergencyNumber: '112' }, openHelp: () => undefined });
export const useShell = () => React.useContext(Ctx);

const NAV = [
  { href: '/app', label: 'Home', icon: Home, exact: true },
  { href: '/app/plan', label: 'Plan route', icon: Compass },
  { href: '/app/journey', label: 'Journey', icon: Radio },
  { href: '/app/contacts', label: 'Contacts', icon: Users },
  { href: '/app/history', label: 'History', icon: History },
  { href: '/app/assistant', label: 'Assistant', icon: Bot },
  { href: '/app/settings', label: 'Privacy & settings', icon: Settings },
];
const TABS = ['/app', '/app/plan', '/app/journey', '/app/contacts'];

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const active = usePoll(() => api<{ view: JourneyView | null }>('/api/journeys/active'), 15000);
  const view = active.data?.view ?? null;
  const [help, setHelp] = React.useState(false);
  const [more, setMore] = React.useState(false);
  const isActive = (n: (typeof NAV)[number]) => (n.exact ? path === n.href : path.startsWith(n.href));
  const openRelay = view?.relays.find((r) => r.status === 'open' || r.status === 'acknowledged' || r.status === 'unanswered')?.id ?? null;

  async function signOut() { await post('/api/auth/logout'); router.push('/'); router.refresh(); }

  const openHelp = React.useCallback(() => setHelp(true), []);
  const ctxVal = React.useMemo(() => ({
    view,
    refresh: active.refresh,
    user,
    openHelp,
  }), [view, active.refresh, user, openHelp]);

  return (
    <Ctx.Provider value={ctxVal}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-surface p-4 lg:flex">
          <Link href="/app" className="mb-6 px-2 pt-2" aria-label="HerWay Beacon home"><Wordmark /></Link>
          <nav className="flex-1 space-y-1" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={isActive(n) ? 'page' : undefined} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground', isActive(n) && 'bg-background text-foreground shadow-card')}>
                <n.icon className={cn('h-[18px] w-[18px]', isActive(n) && 'text-primary')} aria-hidden />{n.label}
                {n.href === '/app/journey' && view && <span className="pulse-dot ml-auto h-2 w-2 rounded-full bg-primary" aria-label="Journey active" />}
              </Link>
            ))}
          </nav>
          <div className="rounded-xl border bg-background p-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{initials(user.name)}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.demo ? 'Demo sandbox' : user.email}</p></div>
            </div>
            <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={signOut}><LogOut className="h-4 w-4" />Sign out</Button>
          </div>
        </aside>

        <div className="min-w-0 w-full max-w-full overflow-x-hidden">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-3 sm:px-4 backdrop-blur lg:hidden">
            <Link href="/app" aria-label="Home" className="min-w-0"><Wordmark /></Link>
            {user.demo && <Badge variant="simulated" className="shrink-0 text-[10px] sm:text-xs">Demo</Badge>}
          </header>
          {view && path !== '/app/journey' && <JourneyBanner view={view} />}
          <main id="main" className="page w-full max-w-full min-w-0 overflow-x-hidden px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 lg:py-8 lg:pb-10">{children}</main>
        </div>

        {/* Floating help while a journey is active */}
        {view && (
          <Button variant="destructive" size="lg" onClick={() => setHelp(true)} className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-3 sm:right-4 z-40 rounded-full shadow-lg lg:bottom-6 lg:right-6" aria-label="Ask my people for help">
            <LifeBuoy className="h-5 w-5" />Help
          </Button>
        )}
        <RelayDialog open={help} onOpenChange={setHelp} journeyActive={!!view} emergencyNumber={user.emergencyNumber} existingRelayId={openRelay} />

        {/* Mobile tab bar */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 pt-1 backdrop-blur lg:hidden" aria-label="Main">
          {NAV.filter((n) => TABS.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(n) ? 'page' : undefined} className={cn('relative flex flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] sm:text-[11px] font-medium text-muted-foreground transition-colors', isActive(n) && 'text-primary')}>
              <n.icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" aria-hidden />{n.label.split(' ')[0]}
              {n.href === '/app/journey' && view && <span className="absolute right-[28%] sm:right-[32%] top-1 h-2 w-2 rounded-full bg-primary" />}
            </Link>
          ))}
          <button onClick={() => setMore(true)} className={cn('flex flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] sm:text-[11px] font-medium text-muted-foreground transition-colors', !TABS.includes(path) && !isActive(NAV[0]!) && 'text-primary')}>
            <MoreHorizontal className="h-4.5 w-4.5 sm:h-5 sm:w-5" aria-hidden />More
          </button>
        </nav>
        <Dialog open={more} onOpenChange={setMore}>
          <DialogContent title="More">
            <div className="space-y-1">
              {NAV.filter((n) => !TABS.includes(n.href)).map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setMore(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted"><n.icon className="h-5 w-5 text-primary" aria-hidden />{n.label}</Link>
              ))}
              <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted"><LogOut className="h-5 w-5 text-muted-foreground" aria-hidden />Sign out</button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Ctx.Provider>
  );
}

function JourneyBanner({ view }: { view: JourneyView }) {
  const now = useNow();
  const j = view.journey;
  const left = Math.round((new Date(j.expectedArrivalAt).getTime() - now) / 1000);
  return (
    <Link href="/app/journey" className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b bg-primary-soft px-3 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm">
      <span className="pulse-dot h-2 w-2 rounded-full bg-primary" aria-hidden />
      <span className="font-medium text-primary">Journey in progress</span>
      <span className="truncate text-foreground/80">{j.origin.name} → {j.destination.name}</span>
      <span className="w-full xs:w-auto xs:ml-auto text-foreground/80">{left > 0 ? `ETA ${fmtTime(j.expectedArrivalAt)} · ${fmtClock(left)} left` : <strong className="text-warning">Past expected arrival</strong>}</span>
    </Link>
  );
}
