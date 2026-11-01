import { route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { activeJourneyFor, journeyView } from '@/lib/journeys';
import { maybeTick } from '@/lib/engine';

export const GET = route(async () => {
  const user = await requireUser();
  void maybeTick().catch(() => {});
  const j = await activeJourneyFor(user.id);
  return { view: j ? await journeyView(j) : null };
});
