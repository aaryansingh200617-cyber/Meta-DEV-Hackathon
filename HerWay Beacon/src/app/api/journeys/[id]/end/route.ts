import { z } from 'zod';
import { body, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { endJourney, getOwnedJourney, journeyView } from '@/lib/journeys';

const schema = z.object({ reason: z.enum(['arrived', 'cancelled']).default('arrived') });

/** Ends the journey. This ALWAYS revokes every contact's access to status and location. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const j = await getOwnedJourney(user.id, id);
  const b = await body(req, schema);
  const ended = await endJourney(j, user, b.reason);
  return { view: await journeyView(ended) };
});
