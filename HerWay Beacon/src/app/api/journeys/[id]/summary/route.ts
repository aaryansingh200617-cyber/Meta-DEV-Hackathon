import { route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { getOwnedJourney } from '@/lib/journeys';
import { summarizeJourney } from '@/lib/ai/assistant';
import { rateLimit } from '@/lib/http';
import { nowIso } from '@/lib/utils';

export const POST = route<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  rateLimit(`sum:${user.id}`, 10, 60_000);
  const j = await getOwnedJourney(user.id, id);
  const [events, relays] = await Promise.all([db().find('events', { journeyId: j.id }, { orderBy: 'at' }), db().find('relays', { journeyId: j.id })]);
  const s = await summarizeJourney(j, events.filter((e) => e.type !== 'ai_summary'), relays, user.settings.aiEnabled);
  const summary = { text: s.text, provider: s.provider === 'meta' ? `Meta · ${s.model}` : 'Local rules engine', at: nowIso() };
  await db().update('journeys', j.id, { summary });
  return { summary };
});
