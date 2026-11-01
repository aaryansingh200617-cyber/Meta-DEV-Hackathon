import { body, notFound, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { encryptField } from '@/lib/crypto';
import { contactSchema } from '@/lib/schemas';
import { presentContact } from '@/lib/account';

async function owned(userId: string, id: string) {
  const c = await db().get('contacts', id);
  if (!c || c.userId !== userId) throw notFound('Contact not found');
  return c;
}

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  await owned(user.id, id);
  const b = await body(req, contactSchema.partial());
  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = b.name;
  if (b.relationship !== undefined) patch.relationship = b.relationship;
  if (b.tier !== undefined) patch.tier = b.tier;
  if (b.phone !== undefined) patch.phoneEnc = encryptField(b.phone);
  if (b.email !== undefined) patch.emailEnc = encryptField(b.email);
  const c = await db().update('contacts', id, patch);
  return { contact: presentContact(c!) };
});

/** Deleting a contact also ends their access immediately and removes their notification devices. */
export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const c = await owned(user.id, id);
  for (const g of (await db().find('grants', { contactId: c.id })).filter((x) => !x.revokedAt)) await db().update('grants', g.id, { revokedAt: new Date().toISOString(), revokedReason: 'user' });
  await db().deleteWhere('push_subscriptions', { contactId: c.id });
  await db().delete('contacts', c.id);
  return { ok: true };
});
