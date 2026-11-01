'use client';
import * as React from 'react';
import * as T from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = T.Root;
export const TabsList = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof T.List>) => (
  <T.List className={cn('inline-flex rounded-xl bg-muted p-1', className)} {...p} />
);
export const TabsTrigger = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof T.Trigger>) => (
  <T.Trigger className={cn('rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-card', className)} {...p} />
);
export const TabsContent = T.Content;
