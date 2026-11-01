'use client';
import * as React from 'react';
import type { EvidenceSegment, RouteEvidence, SegmentStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<SegmentStatus, string> = { fresh: 'Recent (≤30 days)', aging: 'Ageing (31–90 days)', outdated: 'Outdated (>90 days)', missing: 'No data' };

const cellClass: Record<SegmentStatus, string> = {
  fresh: 'bg-primary',
  aging: 'bg-primary/45',
  outdated: 'bg-[repeating-linear-gradient(135deg,hsl(var(--warning)/0.55)_0_3px,transparent_3px_6px)] border border-warning/40',
  missing: 'bg-[repeating-linear-gradient(135deg,hsl(var(--input))_0_2px,transparent_2px_5px)] border border-input',
};
const lightClass = { good: 'bg-primary', moderate: 'bg-muted-foreground/50', poor: 'bg-destructive', none: 'bg-transparent border border-input' } as const;

function cellTitle(s: EvidenceSegment) {
  const where = `${s.fromKm.toFixed(1)}–${s.toKm.toFixed(1)} km`;
  if (s.status === 'missing') return `${where}: no observation available`;
  return `${where}: ${STATUS_LABEL[s.status].toLowerCase()}, newest observation ${s.ageDays} day${s.ageDays === 1 ? '' : 's'} old · lighting ${s.lighting ?? 'not observed'} · visibility ${s.visibility ?? 'not observed'}`;
}

/** The "Evidence Strip": one cell per route segment, shaded by how recent its observations are, with a lighting row beneath. */
export function EvidenceStrip({ segments, showLighting = true, className }: { segments: EvidenceSegment[]; showLighting?: boolean; className?: string }) {
  return (
    <div className={cn('w-full max-w-full overflow-hidden', className)} role="img" aria-label={`Evidence strip: ${segments.filter((s) => s.status === 'fresh').length} recent, ${segments.filter((s) => s.status === 'aging').length} ageing, ${segments.filter((s) => s.status === 'outdated').length} outdated, ${segments.filter((s) => s.status === 'missing').length} segments with no data`}>
      <div className="flex gap-[2px] w-full max-w-full">
        {segments.map((s) => <div key={s.index} title={cellTitle(s)} className={cn('h-4 flex-1 min-w-0 rounded-[3px]', cellClass[s.status])} />)}
      </div>
      {showLighting && (
        <div className="mt-[3px] flex gap-[2px] w-full max-w-full" aria-hidden>
          {segments.map((s) => <div key={s.index} className={cn('h-1.5 flex-1 min-w-0 rounded-full', lightClass[s.lighting ?? 'none'])} />)}
        </div>
      )}
    </div>
  );
}

export function EvidenceLegend({ className }: { className?: string }) {
  const item = (cls: string, t: string) => <span className="inline-flex items-center gap-1.5"><i className={cn('inline-block h-3 w-4 rounded-[3px]', cls)} />{t}</span>;
  return (
    <div className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground', className)}>
      {item(cellClass.fresh, STATUS_LABEL.fresh)}
      {item(cellClass.aging, STATUS_LABEL.aging)}
      {item(cellClass.outdated, STATUS_LABEL.outdated)}
      {item(cellClass.missing, STATUS_LABEL.missing)}
      <span className="inline-flex items-center gap-1.5"><i className="inline-block h-1.5 w-4 rounded-full bg-primary" />Lighting good<i className="ml-1 inline-block h-1.5 w-4 rounded-full bg-destructive" />poor</span>
    </div>
  );
}

export function coverageSummary(ev: RouteEvidence) {
  const c = ev.coverage;
  return `${c.freshPct}% recent · ${c.agingPct}% ageing · ${c.outdatedPct}% outdated · ${c.missingPct}% no data`;
}
