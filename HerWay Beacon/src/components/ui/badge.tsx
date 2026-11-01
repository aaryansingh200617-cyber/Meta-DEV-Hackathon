import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badge = cva('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    variant: {
      neutral: 'bg-muted text-foreground border-transparent',
      blue: 'bg-primary-soft text-primary border-primary/20',
      teal: 'bg-primary-soft text-primary border-primary/20',
      primary: 'bg-primary text-primary-foreground border-transparent',
      success: 'bg-success-soft text-success border-success/20',
      warning: 'bg-warning-soft text-warning border-warning/25',
      danger: 'bg-destructive-soft text-destructive border-destructive/25',
      outline: 'bg-background text-muted-foreground',
      simulated: 'bg-warning-soft text-warning border-dashed border-warning/40',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

export const Badge = ({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) => (
  <span className={cn(badge({ variant }), className)} {...p} />
);
