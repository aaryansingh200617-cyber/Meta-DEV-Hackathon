import { notFound, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { relayDetail } from '@/lib/relay';
import { maybeTick } from '@/lib/engine';

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  await maybeTick();
  const r = await db().get('relays', id);
  if (!r || r.userId !== user.id) throw notFound('Request not found');
  return { relay: await relayDetail(r) };
});
