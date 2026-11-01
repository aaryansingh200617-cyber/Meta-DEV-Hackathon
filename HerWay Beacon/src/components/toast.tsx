'use client';
import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'error' | 'info';
interface T { id: number; title: string; body?: string; tone: Tone }
const Ctx = React.createContext<(t: Omit<T, 'id'>) => void>(() => undefined);
export const useToast = () => React.useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<T[]>([]);
  const push = React.useCallback((t: Omit<T, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-3), { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), t.tone === 'error' ? 8000 : 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6">
        {items.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertTriangle : Info;
          return (
            <div key={t.id} className={cn('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-background p-3.5 shadow-lg', t.tone === 'error' && 'border-destructive/40')}>
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', t.tone === 'success' && 'text-success', t.tone === 'error' && 'text-destructive', t.tone === 'info' && 'text-primary')} aria-hidden />
              <div className="min-w-0 flex-1 text-sm"><p className="font-medium">{t.title}</p>{t.body && <p className="mt-0.5 text-muted-foreground">{t.body}</p>}</div>
              <button onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
