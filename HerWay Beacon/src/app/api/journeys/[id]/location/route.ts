import { z } from 'zod';
import { body, rateLimit, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { getOwnedJourney, recordLocation } from '@/lib/journeys';

const schema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100000).nullable().optional(), simulated: z.boolean().optional() });

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  rateLimit(`loc:${user.id}`, 120, 60_000);
  const j = await getOwnedJourney(user.id, id);
  const b = await body(req, schema);
  const updated = await recordLocation(j, b);
  return { ok: true, deviationState: updated.deviationState, arrivalSuggested: updated.arrivalSuggested };
});
