import * as React from 'react';
import { cn } from '@/lib/utils';

/** HerWay Beacon mark: shield emblem depicting women's safe navigation and route beacon */
export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <img
      src="/logo.png"
      alt="HerWay Beacon Logo"
      width={size}
      height={size}
      className={cn('inline-block shrink-0 object-contain drop-shadow-xs', className)}
      style={{ width: size, height: size }}
    />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 whitespace-nowrap text-left', className)}>
      <Logo size={32} className="shrink-0" />
      <span className="text-[16px] sm:text-[18px] font-bold tracking-tight">
        HerWay <span className="font-normal text-muted-foreground">Beacon</span>
      </span>
    </span>
  );
}
