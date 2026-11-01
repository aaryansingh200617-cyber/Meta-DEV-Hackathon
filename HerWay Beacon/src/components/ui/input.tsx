import * as React from 'react';
import { cn } from '@/lib/utils';

const field = 'flex w-full rounded-xl border border-input bg-background px-3.5 text-base sm:text-sm placeholder:text-muted-foreground/70 disabled:opacity-60';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(field, 'h-11', className)} {...p} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(field, 'min-h-[88px] py-2.5', className)} {...p} />
));
Textarea.displayName = 'Textarea';

const CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%235B6B7F' stroke-width='2'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, style, ...p }, ref) => (
  <select ref={ref} className={cn(field, 'h-11 appearance-none bg-background pr-9', className)} style={{ backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '16px', ...style }} {...p}>
    {children}
  </select>
));
Select.displayName = 'Select';

export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn('mb-1.5 block text-sm font-medium', className)} {...p} />
);

export const FieldHint = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={cn('mt-1.5 text-xs text-muted-foreground', className)} {...p} />;
