import { z } from 'zod';
import { body, forbidden, route } from '@/lib/http';
import { resolveContactToken } from '@/lib/contact-token';
import { db } from '@/lib/store';
import { uid } from '@/lib/crypto';
import { nowIso } from '@/lib/utils';

const schema = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export const POST = route<{ token: string }>(async (req, { token }) => {
  const { contact } = await resolveContactToken(token);
  if (contact.status !== 'accepted') throw forbidden('Accept the invitation first');
  const b = await body(req, schema);
  const existing = (await db().find('push_subscriptions', { contactId: contact.id })).find((s) => s.endpoint === b.endpoint);
  if (!existing) await db().insert('push_subscriptions', { id: uid('ps_'), contactId: contact.id, endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth, createdAt: nowIso() });
  return { ok: true };
});

export const DELETE = route<{ token: string }>(async (_req, { token }) => {
  const { contact } = await resolveContactToken(token);
  await db().deleteWhere('push_subscriptions', { contactId: contact.id });
  return { ok: true };
});
