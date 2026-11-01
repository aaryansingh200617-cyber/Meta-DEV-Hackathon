import { z } from 'zod';
import { body, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { confirmCheckin, getOwnedJourney } from '@/lib/journeys';
import { createRelay } from '@/lib/relay';

const schema = z.object({ response: z.enum(['ok', 'need_help']).default('ok') });

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const j = await getOwnedJourney(user.id, id);
  const b = await body(req, schema);
  await confirmCheckin(j, b.response === 'need_help');
  if (b.response === 'need_help') {
    const relay = await createRelay({ user, kind: 'call_me', journey: j, message: 'Asked for help at a safety check-in.', includeLocation: true, actor: 'traveller' });
    return { ok: true, relayId: relay.id };
  }
  return { ok: true };
});
