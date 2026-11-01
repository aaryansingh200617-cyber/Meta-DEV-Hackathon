import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('w-full max-w-full min-w-0 rounded-2xl border bg-background shadow-card', className)} {...p} />
);
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('flex flex-col gap-1 p-4 sm:p-5 pb-3', className)} {...p} />;
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn('text-base font-semibold leading-tight', className)} {...p} />;
export const CardDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={cn('text-sm text-muted-foreground', className)} {...p} />;
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('p-4 sm:p-5 pt-2 max-w-full min-w-0', className)} {...p} />;
export const CardFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('flex items-center gap-2 border-t p-4', className)} {...p} />;
