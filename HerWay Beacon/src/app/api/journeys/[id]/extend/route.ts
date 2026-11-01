import { z } from 'zod';
import { body, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { extendEta, getOwnedJourney } from '@/lib/journeys';

const schema = z.object({ minutes: z.number().int().min(1).max(240) });

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const j = await getOwnedJourney(user.id, id);
  const b = await body(req, schema);
  await extendEta(j, b.minutes);
  return { ok: true };
});
