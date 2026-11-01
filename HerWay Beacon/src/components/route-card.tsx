'use client';
import * as React from 'react';
import { AlertTriangle, Check, ChevronDown, Clock, Lightbulb, LifeBuoy, Ruler, Shield, ShieldCheck, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EvidenceLegend, EvidenceStrip, coverageSummary } from '@/components/evidence';
import { SimBadge } from '@/components/common';
import type { RouteOption, SafetyTier } from '@/lib/types';
import { cn, fmtAgo, fmtDistance, fmtDuration } from '@/lib/utils';

const KIND: Record<string, string> = {
  police: 'Police',
  hospital: 'Hospital / clinic',
  pharmacy: 'Pharmacy',
  transit: 'Transit stop',
  open_late: 'Late-night shop',
};

/* ─────────────────────────── Safety Tier Badge ─────────────────────────── */

const TIER_CONFIG: Record<
  SafetyTier,
  { label: string; icon: React.ElementType; bg: string; text: string; border: string }
> = {
  safest: {
    label: '🛡 Safest',
    icon: ShieldCheck,
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  balanced: {
    label: '⚡ Balanced',
    icon: Zap,
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  direct: {
    label: '🕐 Direct',
    icon: Clock,
    bg: 'bg-slate-50 dark:bg-slate-900/40',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

function SafetyTierBadge({ tier, score }: { tier: SafetyTier; score: number }) {
  const cfg = TIER_CONFIG[tier];
  return (
    <div className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold', cfg.bg, cfg.text, cfg.border)}>
      <cfg.icon className="h-3.5 w-3.5" aria-hidden />
      {cfg.label}
      <span className="ml-1 font-normal opacity-70">{score}/100</span>
    </div>
  );
}

/* ──────────────────────────── Safety Score Bar ─────────────────────────── */

function SafetyBar({ score, tier }: { score: number; tier: SafetyTier }) {
  const color =
    tier === 'safest'
      ? 'bg-emerald-500'
      : tier === 'balanced'
        ? 'bg-[#1877F2]'
        : 'bg-slate-400';
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-all duration-700', color)}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

/* ──────────────────────────── Safety Signal Pills ──────────────────────── */

function SignalPills({ route }: { route: RouteOption }) {
  const sig = route.safetySignals;
  if (!sig?.dataAvailable) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5 max-w-full">
      {sig.litWaysNearby > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          🔦 {sig.litWaysNearby} lit road{sig.litWaysNearby !== 1 ? 's' : ''}
        </span>
      )}
      {sig.primaryRoadPct > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          🚦 {Math.round(sig.primaryRoadPct * 100)}% arterial
        </span>
      )}
      {sig.assistPointsCount > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          👮 {sig.assistPointsCount} help point{sig.assistPointsCount !== 1 ? 's' : ''}
        </span>
      )}
      {sig.commercialDensity > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          🏪 {sig.commercialDensity} shops/cafes
        </span>
      )}
      {sig.longestDarkStretchM > 300 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800">
          ⚠ {Math.round(sig.longestDarkStretchM / 100) * 100} m low-light stretch
        </span>
      )}
    </div>
  );
}

/* ────────────────────────────── Route Card ─────────────────────────────── */

export function RouteCard({
  route,
  color,
  selected,
  onSelect,
  fastest,
}: {
  route: RouteOption;
  color: string;
  selected: boolean;
  onSelect: () => void;
  fastest?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ev = route.evidence;
  const hasSafety = route.safetyTier != null && route.safetyScore != null;

  const gaps: string[] = [];
  if (ev.coverage.missingPct >= 20) gaps.push(`${ev.coverage.missingPct}% of this route has no observation`);
  if (ev.coverage.outdatedPct >= 15) gaps.push(`${ev.coverage.outdatedPct}% rests on data older than 90 days`);
  if (!ev.assist.length) gaps.push('no assistance locations found nearby');
  else if (ev.longestAssistGapKm >= 0.8) gaps.push(`${ev.longestAssistGapKm} km stretch without a nearby assistance location`);

  return (
    <article
      className={cn(
        'cursor-pointer w-full max-w-full min-w-0 overflow-hidden rounded-2xl border bg-background p-3.5 shadow-card transition-all sm:p-5 hover:border-primary/50',
        selected && 'border-primary ring-2 ring-primary/30 shadow-md',
        hasSafety && route.safetyTier === 'safest' && !selected && 'border-emerald-300 dark:border-emerald-700',
      )}
      onClick={onSelect}
      aria-label={route.label}
    >
      {/* ── Safety tier header ── */}
      {hasSafety && (
        <div className="mb-3 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <SafetyTierBadge tier={route.safetyTier!} score={route.safetyScore!} />
            <div className="flex gap-1.5 flex-wrap">
              {fastest && <Badge variant="teal">Quickest</Badge>}
              {route.simulated && <SimBadge label="Simulated" />}
            </div>
          </div>
          <div className="mt-2.5">
            <SafetyBar score={route.safetyScore!} tier={route.safetyTier!} />
          </div>
          {route.safetyLabel && (
            <p className="mt-1.5 text-xs font-medium text-foreground/80 break-words">{route.safetyLabel}</p>
          )}
          {route.safetyReason && (
            <p className="mt-0.5 text-xs text-muted-foreground break-words">{route.safetyReason}</p>
          )}
          <SignalPills route={route} />
        </div>
      )}

      {/* ── Route name + summary ── */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <i className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
            <h3 className="truncate font-semibold">{route.label}</h3>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground break-words">{route.summary}</p>
        </div>
        {!hasSafety && (
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {fastest && <Badge variant="teal">Quickest</Badge>}
            {route.simulated && <SimBadge label="Simulated" />}
          </div>
        )}
      </div>

      {/* ── Duration + distance (secondary role after safety) ── */}
      <div className="mt-3 flex items-end gap-3 sm:gap-5 flex-wrap">
        <div>
          <p className="flex items-center gap-1.5 text-lg sm:text-xl font-semibold">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            {fmtDuration(route.durationS)}
          </p>
          <p className="text-xs text-muted-foreground">est. travel time</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-sm sm:text-base font-medium text-muted-foreground">
            <Ruler className="h-4 w-4 shrink-0" aria-hidden />
            {fmtDistance(route.distanceM)}
          </p>
        </div>
      </div>

      {/* ── Evidence strip ── */}
      <div className="mt-4 min-w-0 w-full max-w-full">
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-1 sm:gap-2">
          <p className="text-xs font-medium">Community evidence along the route</p>
          <p className="text-right text-xs text-muted-foreground truncate max-w-full">
            {ev.newestObservationAt ? `newest ${fmtAgo(ev.newestObservationAt)}` : 'no dated observations'}
          </p>
        </div>
        <EvidenceStrip segments={ev.segments} />
        <p className="mt-2 text-xs text-muted-foreground break-words">{coverageSummary(ev)}</p>
      </div>

      {/* ── Quick badges ── */}
      <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
        <Badge variant="outline" className="max-w-full">
          <LifeBuoy className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{ev.assist.length} help point{ev.assist.length === 1 ? '' : 's'} ≤250 m</span>
        </Badge>
        <Badge variant={ev.lightingPoorSegments ? 'warning' : 'outline'} className="max-w-full">
          <Lightbulb className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{ev.lightingPoorSegments} poorly-lit segment{ev.lightingPoorSegments === 1 ? '' : 's'} reported</span>
        </Badge>
      </div>

      {/* ── Data gap warnings ── */}
      {gaps.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-xs text-warning max-w-full">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <p className="min-w-0 break-words leading-relaxed">
            <strong className="font-semibold">Data gaps:</strong> {gaps.join('; ')}. Treat this
            route&apos;s information as incomplete.
          </p>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="mt-4 flex flex-col xs:flex-row items-stretch xs:items-center gap-2">
        <Button onClick={onSelect} variant={selected ? 'default' : 'outline'} size="sm" className="w-full xs:w-auto">
          {selected ? (
            <>
              <Check className="h-4 w-4" />
              Selected
            </>
          ) : (
            'Choose this route'
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full xs:w-auto"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          aria-expanded={open}
        >
          Evidence details
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </Button>
      </div>

      {/* ── Expandable evidence details ── */}
      {open && (
        <div className="mt-4 space-y-4 border-t pt-4 text-sm">
          <EvidenceLegend />
          <div>
            <p className="mb-1.5 font-medium">Assistance locations within 250 m</p>
            {ev.assist.length ? (
              <ul className="space-y-1.5 text-muted-foreground">
                {ev.assist.map((a) => (
                  <li key={a.id} className="flex flex-col xs:flex-row xs:justify-between gap-0.5 xs:gap-3 py-0.5">
                    <span className="text-foreground/90 font-medium xs:font-normal">{a.name}</span>
                    <span className="shrink-0 text-xs xs:text-sm">
                      {KIND[a.kind]} · {a.offRouteM} m
                      {a.openNow === true ? ' · open now' : a.openNow === false ? ' · closed now' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                None found. This may be a data gap rather than a true absence.
              </p>
            )}
          </div>
          <div>
            <p className="mb-1.5 font-medium">Most recent observations</p>
            <ul className="space-y-1.5 text-muted-foreground">
              {[...ev.observations]
                .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
                .slice(0, 6)
                .map((o) => (
                  <li key={o.id} className="flex flex-col xs:flex-row xs:justify-between gap-0.5 xs:gap-3 py-0.5">
                    <span className="capitalize text-foreground/90 font-medium xs:font-normal">
                      {o.kind}: {o.value}
                    </span>
                    <span className="shrink-0 text-xs xs:text-sm">
                      {fmtAgo(o.observedAt)} · {o.source === 'demo' ? 'simulated' : 'community report'}
                    </span>
                  </li>
                ))}
              {!ev.observations.length && <li>No observations for this route.</li>}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}
