import { z } from 'zod';
import { body, rateLimit, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { compareRoutes } from '@/lib/routing';
import { explainRoutes, parseIntent, summarizeJourney, localIntent } from '@/lib/ai/assistant';
import { looksUrgent } from '@/lib/ai/urgency';
import { activeJourneyFor } from '@/lib/journeys';
import { modeSchema, placeSchema } from '@/lib/schemas';
import { env } from '@/lib/env';
import { DISCLAIMER } from '@/lib/defaults';

const schema = z.object({
  message: z.string().trim().min(1).max(600),
  plan: z.object({ origin: placeSchema, destination: placeSchema, mode: modeSchema }).optional(),
});

export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`ai:${user.id}`, 30, 60_000);
  const b = await body(req, schema);
  const provider = env.metaKey && user.settings.aiEnabled ? 'meta' : 'local';

  // 1. Safety first, deterministic, no model involved.
  if (looksUrgent(b.message)) {
    return {
      kind: 'urgent', provider: 'local', model: null, citations: [], notes: [],
      answer: `This sounds urgent. If you are in immediate danger, call ${user.settings.emergencyNumber} now. HerWay Beacon cannot call emergency services for you. You can also ask your trusted contacts to call you right away.`,
      actions: [{ type: 'call', number: user.settings.emergencyNumber }, { type: 'relay' }],
    };
  }

  const contacts = await db().find('contacts', { userId: user.id });
  const active = await activeJourneyFor(user.id);
  const wantsJourney = /\b(what happened|summar|so far|timeline|recap|how (is|am) my journey)\b/i.test(b.message);

  // 2. Journey recap
  if (wantsJourney && active) {
    const [events, relays] = await Promise.all([db().find('events', { journeyId: active.id }, { orderBy: 'at' }), db().find('relays', { journeyId: active.id })]);
    const s = await summarizeJourney(active, events, relays, user.settings.aiEnabled);
    return { kind: 'summary', answer: s.text, provider: s.provider, model: s.model, citations: [], notes: [] };
  }

  // 3. Route trade-offs (grounded in evidence)
  const local = localIntent(b.message, contacts);
  const explainish = local.kind === 'explain' || /\b(why|which|compare|safer|lit|light|dark|slow|faster|shorter|assist|police|data)\b/i.test(b.message);
  if (b.plan && explainish) {
    const { routes } = await compareRoutes(b.plan.origin, b.plan.destination, b.plan.mode);
    const g = await explainRoutes(b.message, routes, user.settings.aiEnabled);
    return { kind: 'explain', ...g, disclaimer: DISCLAIMER };
  }

  // 4. Natural-language request → prefilled plan (the user still reviews and confirms everything)
  const parsed = await parseIntent(b.message, contacts, user.settings.aiEnabled);
  if (parsed.destination || parsed.origin) {
    const bits = [parsed.origin ? `from ${parsed.origin.name}` : null, parsed.destination ? `to ${parsed.destination.name}` : null, parsed.intent.mode ? `by ${parsed.intent.mode}` : null, parsed.intent.checkinMinutes ? `with check-ins every ${parsed.intent.checkinMinutes} min` : null, parsed.shareContactNames.length ? `sharing with ${parsed.shareContactNames.join(', ')}` : null].filter(Boolean).join(' ');
    return {
      kind: 'prefill', provider: parsed.provider, model: parsed.provider === 'meta' ? env.metaModel : null, citations: [], notes: parsed.unresolved.length ? [`I could not find: ${parsed.unresolved.join(', ')}.`] : [],
      answer: `I have set up a plan ${bits}. Nothing has started — review the routes and confirm the details yourself.`,
      prefill: { origin: parsed.origin, destination: parsed.destination, mode: parsed.intent.mode ?? null, checkinMinutes: parsed.intent.checkinMinutes ?? null, etaMinutes: parsed.intent.etaMinutes ?? null, shareContactNames: parsed.shareContactNames },
    };
  }

  return {
    kind: 'help', provider, model: null, citations: [], notes: [],
    answer: b.plan
      ? 'I can explain how the routes you are comparing differ — try “Which route has the most recent lighting data?” or “Why is Route C shorter?”.'
      : 'I can set up a plan from a sentence (for example “Walk from MG Road Metro to Home, check in every 10 minutes, share with Meera”), explain route trade-offs after you compare routes, or recap your current journey. I never start anything without your confirmation.',
  };
});
