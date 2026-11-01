'use client';
import * as React from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, title, description, hideClose, ...p }: React.ComponentPropsWithoutRef<typeof D.Content> & { title: string; description?: string; hideClose?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-[hsl(215_70%_13%/0.45)] backdrop-blur-xs" />
      <D.Content
        className={cn('fixed z-50 flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto bg-background p-4 sm:p-6 shadow-xl focus:outline-none', 'inset-x-0 bottom-0 rounded-t-3xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl', className)}
        {...p}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <D.Title className="text-base sm:text-lg font-semibold">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-xs sm:text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          {!hideClose && <D.Close className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close"><X className="h-5 w-5" /></D.Close>}
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
