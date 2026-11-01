'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, Bot, Mic, MicOff, PhoneCall, Sparkles, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { errMsg, post } from '@/lib/client/api';
import { useShell } from '@/components/app-shell';
import type { Place, TravelMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Citation { id: string; text: string }
interface Reply {
  kind: string; answer: string; provider: 'meta' | 'local'; model: string | null; citations: Citation[]; notes: string[];
  actions?: { type: 'call' | 'relay'; number?: string }[];
  prefill?: { origin: Place | null; destination: Place | null; mode: TravelMode | null; checkinMinutes: number | null; etaMinutes: number | null; shareContactNames: string[] };
}
interface Msg { role: 'user' | 'assistant'; text: string; reply?: Reply }

export const PREFILL_KEY = 'sj_prefill';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function AssistantChat({ plan, compact, suggestions, onPrefill }: { plan?: { origin: Place; destination: Place; mode: TravelMode } | null; compact?: boolean; suggestions: string[]; onPrefill?: (p: NonNullable<Reply['prefill']>) => void }) {
  const router = useRouter();
  const { openHelp } = useShell();
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [voiceOk, setVoiceOk] = React.useState(false);
  const rec = React.useRef<any>(null);
  const end = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { setVoiceOk(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)); }, []);
  React.useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs, busy]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: t }]);
    setInput(''); setBusy(true);
    try {
      const r = await post<Reply>('/api/ai/chat', { message: t, plan: plan ?? undefined });
      setMsgs((m) => [...m, { role: 'assistant', text: r.answer, reply: r }]);
      if (r.kind === 'prefill' && r.prefill) {
        if (onPrefill) onPrefill(r.prefill);
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: `I couldn’t reach the assistant (${errMsg(e)}). Everything else in the app, including help requests, still works.` }]);
    } finally { setBusy(false); }
  }

  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new SR();
    r.lang = navigator.language || 'en-IN'; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = (e: any) => setInput(Array.from(e.results).map((x: any) => x[0].transcript).join(' '));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; setListening(true); r.start();
  }

  function goPlan(p: NonNullable<Reply['prefill']>) {
    try { sessionStorage.setItem(PREFILL_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
    router.push('/app/plan');
  }

  return (
    <div className={cn('flex flex-col rounded-2xl border bg-background', compact ? 'h-[360px] sm:h-[420px]' : 'h-[min(75dvh,600px)]')}>
      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {msgs.length === 0 && (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-sm">
              <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-primary"><Bot className="h-5 w-5" aria-hidden /></div>
              <p className="font-medium">Ask HerWay</p>
              <p className="mt-1 text-sm text-muted-foreground">I explain route trade-offs using only the evidence shown, and turn a sentence into a plan. I never start anything without you.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">{suggestions.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border px-3 py-1.5 text-left text-xs hover:bg-surface">{s}</button>)}</div>
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' && 'justify-end')}>
            <div className={cn('max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-surface')}>
              {m.reply?.kind === 'urgent' && <p className="mb-1 font-semibold text-destructive">This sounds urgent</p>}
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.reply?.actions && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.reply.actions.map((a) => a.type === 'call'
                    ? <Button key="call" asChild variant="destructive" size="sm"><a href={`tel:${a.number}`}><PhoneCall className="h-4 w-4" />Call {a.number}</a></Button>
                    : <Button key="relay" variant="outline" size="sm" onClick={openHelp}><LifeBuoy className="h-4 w-4" />Ask my contacts to call me</Button>)}
                </div>
              )}
              {m.reply?.prefill && (
                <div className="mt-3 rounded-xl border bg-background p-3 text-xs text-foreground">
                  <p className="font-medium">Suggested plan</p>
                  <p className="mt-1 text-muted-foreground">{m.reply.prefill.origin?.name ?? 'Current location'} → {m.reply.prefill.destination?.name ?? '—'}{m.reply.prefill.mode ? ` · ${m.reply.prefill.mode}` : ''}{m.reply.prefill.checkinMinutes ? ` · check-in every ${m.reply.prefill.checkinMinutes} min` : ''}{m.reply.prefill.shareContactNames.length ? ` · share with ${m.reply.prefill.shareContactNames.join(', ')}` : ''}</p>
                  {!onPrefill && <Button size="sm" className="mt-2" onClick={() => goPlan(m.reply!.prefill!)}>Review in route planner</Button>}
                </div>
              )}
              {m.reply && m.role === 'assistant' && (
                <div className="mt-3 space-y-2">
                  {m.reply.citations.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Grounded in {m.reply.citations.length} evidence item{m.reply.citations.length === 1 ? '' : 's'}</summary>
                      <ul className="mt-2 space-y-1.5 text-muted-foreground">{m.reply.citations.map((c) => <li key={c.id}><Badge variant="outline" className="mr-1.5">{c.id}</Badge>{c.text}</li>)}</ul>
                    </details>
                  )}
                  {m.reply.notes.map((n) => <p key={n} className="text-xs text-warning">{n}</p>)}
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Sparkles className="h-3 w-3" aria-hidden />{m.reply.provider === 'meta' ? `Meta Model API · ${m.reply.model}` : 'Local rules engine — no AI model used'}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="flex"><div className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted-foreground" aria-busy>Thinking…</div></div>}
        <div ref={end} />
      </div>
      <form className="flex items-center gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        {voiceOk && (
          <Button type="button" variant={listening ? 'destructive' : 'outline'} size="icon" onClick={toggleVoice} aria-label={listening ? 'Stop voice input' : 'Start voice input'} aria-pressed={listening}>{listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button>
        )}
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={600} placeholder={listening ? 'Listening…' : plan ? 'Ask about these routes…' : 'Describe your journey…'} aria-label="Message" className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3.5 text-sm" />
        <Button type="submit" size="icon" disabled={!input.trim() || busy} aria-label="Send"><ArrowUp className="h-4 w-4" /></Button>
      </form>
      {!voiceOk && <p className="px-4 pb-2 text-[11px] text-muted-foreground">Voice input isn’t supported in this browser.</p>}
    </div>
  );
}
