import { route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { getOwnedJourney, journeyView } from '@/lib/journeys';
import { deleteJourneyData, maybeTick } from '@/lib/engine';
import { conflict } from '@/lib/http';

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  await maybeTick();
  return { view: await journeyView(await getOwnedJourney(user.id, id)) };
});

/** User-controlled retention: delete a finished journey and everything attached to it. */
export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const j = await getOwnedJourney(user.id, id);
  if (j.status === 'active') throw conflict('End the journey before deleting it.');
  await deleteJourneyData(j.id);
  return { ok: true };
});
