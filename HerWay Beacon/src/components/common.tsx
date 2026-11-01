'use client';
import * as React from 'react';
import { AlertTriangle, FlaskConical, Inbox, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function EmptyState({ icon: Icon = Inbox, title, body, action, className }: { icon?: React.ElementType; title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center rounded-2xl border border-dashed bg-surface px-6 py-10 text-center', className)}>
      <div className="mb-3 rounded-full bg-background p-3 text-muted-foreground shadow-card"><Icon className="h-5 w-5" aria-hidden /></div>
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error | string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive-soft p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
      <div className="flex-1"><p className="font-medium text-destructive">Something needs attention</p><p className="mt-0.5 text-foreground/80">{typeof error === 'string' ? error : error.message}</p></div>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Retry</Button>}
    </div>
  );
}

export function SimBadge({ label = 'Simulated demo data' }: { label?: string }) {
  return <Badge variant="simulated" title="This information is generated for demonstration and does not describe real conditions"><FlaskConical className="h-3 w-3" aria-hidden />{label}</Badge>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl sm:text-2xl font-semibold md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-xs sm:text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">{actions}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3" aria-busy="true" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn('rounded-xl bg-surface px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground', className)}>
      HerWay Beacon shows <strong className="font-medium text-foreground">dated observations, not safety guarantees</strong>. It does not contact police or emergency services — call your local emergency number yourself if you are in danger.
    </p>
  );
}
