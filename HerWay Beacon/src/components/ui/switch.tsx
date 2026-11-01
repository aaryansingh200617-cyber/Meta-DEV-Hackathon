'use client';
import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(({ className, ...p }, ref) => (
  <SwitchPrimitive.Root ref={ref} className={cn('peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input transition-colors data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50', className)} {...p}>
    <SwitchPrimitive.Thumb className="pointer-events-none block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

/** Switch with a label + description row — the consent pattern used throughout the app. */
export function ToggleRow({ checked, onChange, title, description, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; title: string; description?: string; disabled?: boolean; id: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm font-medium">{title}</span>
        {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
