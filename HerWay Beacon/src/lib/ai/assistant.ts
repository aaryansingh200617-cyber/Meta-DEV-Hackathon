import type { Journey, JourneyEvent, Relay, RouteOption, TravelMode, Contact, Place } from '../types';
import { env } from '../env';
import { FORBIDDEN_CLAIMS } from '../defaults';
import { extractJson, metaComplete } from './meta';
import { journeyFacts, routeFacts, type Fact } from './facts';
import { fmtDuration, fmtDistance } from '../utils';
import { searchPlaces } from '../routing';

export interface Grounded {
  answer: string;
  citations: Fact[];
  provider: 'meta' | 'local';
  model: string | null;
  notes: string[];
}

const RULES = `You are HerWay, a careful travel-safety assistant inside a journey-planning app.
Hard rules:
1. Use ONLY the numbered FACTS provided. Never invent places, numbers, dates, lighting, crowd levels or crime data.
2. NEVER say or imply a route is safe, unsafe, guaranteed, protected or risk-free. Describe evidence (what was observed, when, how much is missing) and let the traveller decide.
3. Always point out missing or outdated data when it is relevant to the question.
4. NEVER claim police, ambulance or emergency services have been or will be contacted. The app does not contact them.
5. Be concise (under 150 words), plain-spoken and respectful. No emojis.
6. If the question cannot be answered from the FACTS, say what is missing.
Respond with ONLY a JSON object: {"answer": string, "citations": string[]} where citations are the fact ids (e.g. "F3") you relied on.`;

function guard(answer: string, facts: Fact[], cited: string[] | undefined): { ok: boolean; citations: Fact[] } {
  const ids = new Set(facts.map((f) => f.id));
  const citations = (cited ?? []).filter((c) => ids.has(c)).map((c) => facts.find((f) => f.id === c)!);
  const ok = !FORBIDDEN_CLAIMS.test(answer) && citations.length > 0 && answer.trim().length > 0;
  return { ok, citations };
}

/* ─────────────── Route trade-offs ─────────────── */

function localRouteAnswer(question: string, routes: RouteOption[], facts: Fact[]): { answer: string; cites: string[] } {
  const f = (r: RouteOption, k: number) => facts.find((x) => x.routeId === r.id && x.id === facts.filter((y) => y.routeId === r.id)[k]?.id)!;
  const by = <T,>(fn: (r: RouteOption) => T, dir: 1 | -1 = 1) => [...routes].sort((a, b) => ((fn(a) as number) - (fn(b) as number)) * dir)[0]!;
  const fastest = by((r) => r.durationS);
  const shortest = by((r) => r.distanceM);
  const bestCover = by((r) => r.evidence.coverage.missingPct + r.evidence.coverage.outdatedPct);
  const mostAssist = by((r) => r.evidence.assist.length, -1);
  const smallestGap = by((r) => r.evidence.longestAssistGapKm);
  const q = question.toLowerCase();
  const lines: string[] = [];
  const cites = new Set<string>();
  const cite = (r: RouteOption, k: number) => cites.add(f(r, k).id);

  lines.push(`${fastest.label} is the quickest at ${fmtDuration(fastest.durationS)}${shortest.id !== fastest.id ? `, while ${shortest.label} is the shortest at ${fmtDistance(shortest.distanceM)}` : ''}.`);
  cite(fastest, 0); cite(shortest, 0);
  const cov = bestCover.evidence.coverage;
  lines.push(`${bestCover.label} has the most complete recent evidence (${cov.missingPct}% of segments with no data, ${cov.outdatedPct}% outdated) — but other routes have more gaps, so treat their lighting information as incomplete.`);
  cite(bestCover, 1);
  if (/light|dark|visib|night/.test(q)) {
    const r = by((x) => x.evidence.lightingPoorSegments);
    lines.push(`For lighting, ${r.label} has the fewest segments reported as poor (${r.evidence.lightingPoorSegments}); observations vary in age, so check the dated segments.`);
    cite(r, 2);
  }
  lines.push(`${mostAssist.label} has the most assistance locations near it (${mostAssist.evidence.assist.length}); ${smallestGap.label} has the shortest stretch without one (about ${smallestGap.evidence.longestAssistGapKm} km).`);
  cite(mostAssist, 3); cite(smallestGap, 3);
  const sim = facts.find((x) => x.text.startsWith('These routes'));
  if (sim) { lines.push('Note: this is simulated demonstration data.'); cites.add(sim.id); }
  lines.push('None of this guarantees safety — please choose based on your own judgement.');
  cites.add(facts[facts.length - 1]!.id);
  return { answer: lines.join(' '), cites: [...cites] };
}

export async function explainRoutes(question: string, routes: RouteOption[], aiEnabled = true): Promise<Grounded> {
  const facts = routeFacts(routes);
  const notes: string[] = [];
  if (aiEnabled && env.metaKey) {
    try {
      const r = await metaComplete({ system: RULES, user: `FACTS:\n${facts.map((x) => `${x.id}: ${x.text}`).join('\n')}\n\nQUESTION: ${question}` });
      const j = extractJson<{ answer: string; citations: string[] }>(r.text);
      if (j?.answer) {
        const g = guard(j.answer, facts, j.citations);
        if (g.ok) return { answer: j.answer.trim(), citations: g.citations, provider: 'meta', model: r.model, notes };
        notes.push('The AI reply was discarded because it was not grounded in the evidence or made a safety claim; showing the rules-based comparison instead.');
      } else notes.push('The AI reply could not be parsed; showing the rules-based comparison instead.');
    } catch (e) {
      notes.push(`AI service unavailable (${(e as Error).message}); showing the rules-based comparison instead.`);
    }
  } else if (!env.metaKey) notes.push('No MODEL_API_KEY configured — using the built-in rules-based explainer.');
  const l = localRouteAnswer(question, routes, facts);
  return { answer: l.answer, citations: l.cites.map((id) => facts.find((x) => x.id === id)!).filter(Boolean), provider: 'local', model: null, notes };
}

/* ─────────────── Journey summary ─────────────── */

function localSummary(j: Journey, events: JourneyEvent[], relays: Relay[]): string {
  const t = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const c = (type: string) => events.filter((e) => e.type === type).length;
  const parts = [`${j.origin.name} → ${j.destination.name}, started ${t(j.startedAt)}${j.endedAt ? `, ended ${t(j.endedAt)} (${j.endReason === 'arrived' ? 'arrival confirmed by you' : j.endReason})` : ' and still in progress'}.`];
  parts.push(`${c('checkin_confirmed')} check-in(s) confirmed, ${c('checkin_missed')} missed.`);
  const dev = c('deviation_detected');
  if (dev) parts.push(`${dev} route deviation prompt(s).`);
  if (relays.length) {
    const ack = events.filter((e) => e.type === 'relay_acknowledged');
    parts.push(`${relays.length} help request(s)${ack.length ? `; ${ack.map((e) => e.message.replace(/\.$/, '')).join('; ')}` : '; none acknowledged'}.`);
    const act = events.filter((e) => e.type === 'relay_action');
    if (act.length) parts.push(`Contact-reported actions: ${act.map((e) => e.message.replace(/\.$/, '')).join('; ')}.`);
  }
  const rev = events.find((e) => e.type === 'access_revoked');
  if (rev) parts.push(`Contact access ended at ${t(rev.at)}.`);
  return parts.join(' ');
}

export async function summarizeJourney(j: Journey, events: JourneyEvent[], relays: Relay[], aiEnabled = true): Promise<{ text: string; provider: 'meta' | 'local'; model: string | null }> {
  const facts = journeyFacts(j, events, relays);
  if (aiEnabled && env.metaKey) {
    try {
      const r = await metaComplete({
        system: `You summarise a personal journey log for the traveller. Use ONLY the numbered FACTS. Do not speculate, do not add advice, do not call anything safe or unsafe, and never claim emergency services were contacted. Contact statements are "reported by contact" and unverified. Max 110 words, plain prose, no emojis. Respond with ONLY JSON: {"answer": string, "citations": string[]}.`,
        user: `FACTS:\n${facts.map((x) => `${x.id}: ${x.text}`).join('\n')}`,
      });
      const p = extractJson<{ answer: string; citations: string[] }>(r.text);
      if (p?.answer && guard(p.answer, facts, p.citations).ok) return { text: p.answer.trim(), provider: 'meta', model: r.model };
    } catch { /* fall back */ }
  }
  return { text: localSummary(j, events, relays), provider: 'local', model: null };
}

/* ─────────────── Natural-language request → form prefill ─────────────── */

export interface Intent {
  kind: 'plan' | 'explain' | 'other';
  originText?: string;
  destinationText?: string;
  mode?: TravelMode;
  checkinMinutes?: number;
  etaMinutes?: number;
  shareWith?: string[];
}

const END = String.raw`(?=\s*(?:[.,;]|\band\b|\bby\b|\bwith\b|\bcheck|\bevery\b|\bin\b\s+\d|\bshare\b|\btell\b|\blet\b|\bplease\b|$))`;

export function localIntent(text: string, contacts: Pick<Contact, 'name'>[]): Intent {
  const t = text.trim();
  const out: Intent = { kind: /\b(why|explain|compare|difference|which|better|trade-?off)\b/i.test(t) ? 'explain' : 'plan' };
  const m = t.match(new RegExp(String.raw`\bfrom\s+(.+?)\s+to\s+(.+?)${END}`, 'i'));
  if (m) { out.originText = m[1]!.trim(); out.destinationText = m[2]!.trim(); }
  else {
    const d = t.match(new RegExp(String.raw`\b(?:to|towards|home)\b\s*(.*?)${END}`, 'i'));
    if (/\bhome\b/i.test(t) && !d?.[1]) out.destinationText = 'Home';
    else if (d?.[1]) out.destinationText = d[1].trim();
  }
  if (/\b(walk|walking|on foot)\b/i.test(t)) out.mode = 'walk';
  else if (/\b(bus|metro|train|transit|subway)\b/i.test(t)) out.mode = 'transit';
  else if (/\b(cab|auto|taxi|car|drive|driving|uber|ola|rickshaw)\b/i.test(t)) out.mode = 'drive';
  const c = t.match(/check[- ]?ins?(?:\s+(?:with me|on me))?\s*(?:every|each)?\s*(\d+)\s*(min|mins|minutes|hour|hours|h)\b/i) ?? t.match(/every\s+(\d+)\s*(min|mins|minutes|hour|hours|h)\b/i);
  if (c) out.checkinMinutes = Number(c[1]) * (/^h/i.test(c[2]!) ? 60 : 1);
  const e = t.match(/\b(?:in|within|about)\s+(\d+)\s*(min|mins|minutes|hour|hours|h)\b/i);
  if (e && !/check/i.test(t.slice(Math.max(0, (e.index ?? 0) - 12), e.index))) out.etaMinutes = Number(e[1]) * (/^h/i.test(e[2]!) ? 60 : 1);
  const named = contacts.filter((x) => new RegExp(`\\b${x.name.split(/\s+/)[0]!.replace(/[^\w]/g, '')}\\b`, 'i').test(t)).map((x) => x.name);
  if (named.length) out.shareWith = named;
  return out;
}

export interface ResolvedIntent {
  intent: Intent;
  origin: Place | null;
  destination: Place | null;
  shareContactNames: string[];
  provider: 'meta' | 'local';
  unresolved: string[];
}

export async function parseIntent(text: string, contacts: Pick<Contact, 'name'>[], aiEnabled = true): Promise<ResolvedIntent> {
  let intent = localIntent(text, contacts);
  let provider: 'meta' | 'local' = 'local';
  if (aiEnabled && env.metaKey) {
    try {
      const r = await metaComplete({
        system: `Extract a travel request as JSON only. Keys: kind ("plan"|"explain"|"other"), originText, destinationText, mode ("walk"|"drive"|"transit"), checkinMinutes (number), etaMinutes (number), shareWith (array of names from: ${contacts.map((c) => c.name).join(', ') || 'none'}). Omit keys that are not stated. Never invent places. Output ONLY the JSON object.`,
        user: text,
        maxOutputTokens: 800,
      });
      const j = extractJson<Intent>(r.text);
      if (j && ['plan', 'explain', 'other'].includes(j.kind)) {
        intent = { ...localIntent(text, contacts), ...j };
        provider = 'meta';
      }
    } catch { /* local parse stands */ }
  }
  const unresolved: string[] = [];
  const resolve = async (q?: string) => {
    if (!q) return null;
    const { places } = await searchPlaces(q.replace(/^my\s+/i, ''));
    if (!places[0]) unresolved.push(q);
    return places[0] ?? null;
  };
  const [origin, destination] = await Promise.all([resolve(intent.originText), resolve(intent.destinationText)]);
  const names = (intent.shareWith ?? []).map((n) => contacts.find((c) => c.name.toLowerCase().startsWith(n.toLowerCase().split(/\s+/)[0]!))?.name).filter((x): x is string => !!x);
  return { intent, origin, destination, shareContactNames: names, provider, unresolved };
}
