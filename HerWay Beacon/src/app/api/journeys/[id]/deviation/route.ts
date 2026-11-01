import { z } from 'zod';
import { body, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { getOwnedJourney, respondDeviation } from '@/lib/journeys';

const schema = z.object({ response: z.enum(['ok', 'snooze', 'alert']) });

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const j = await getOwnedJourney(user.id, id);
  const b = await body(req, schema);
  await respondDeviation(j, user, b.response);
  return { ok: true };
});
