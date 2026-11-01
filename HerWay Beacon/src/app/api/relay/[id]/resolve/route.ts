import { z } from 'zod';
import { body, notFound, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { relayDetail, resolveRelay } from '@/lib/relay';

const schema = z.object({ reason: z.enum(['traveller_safe', 'cancelled']).default('traveller_safe') });

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const r = await db().get('relays', id);
  if (!r || r.userId !== user.id) throw notFound('Request not found');
  const b = await body(req, schema);
  await resolveRelay(r, b.reason);
  return { relay: await relayDetail((await db().get('relays', id))!) };
});
