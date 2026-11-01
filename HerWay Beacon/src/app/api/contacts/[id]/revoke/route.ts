import { notFound, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { addEvent } from '@/lib/events';
import { nowIso } from '@/lib/utils';

/** Withdraw a contact's access everywhere, immediately, without deleting them. */
export const POST = route<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const c = await db().get('contacts', id);
  if (!c || c.userId !== user.id) throw notFound('Contact not found');
  const live = (await db().find('grants', { contactId: id })).filter((g) => !g.revokedAt);
  for (const g of live) await db().update('grants', g.id, { revokedAt: nowIso(), revokedReason: 'user' });
  await db().update('contacts', id, { status: 'revoked', tokenVersion: c.tokenVersion + 1 });
  await db().deleteWhere('push_subscriptions', { contactId: id });
  for (const jid of new Set(live.map((g) => g.journeyId))) await addEvent({ userId: user.id, journeyId: jid, type: 'access_revoked', actor: 'traveller', message: `You withdrew ${c.name}'s access.` });
  return { ok: true, revokedGrants: live.length };
});
