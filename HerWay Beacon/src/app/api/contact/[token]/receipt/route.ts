import { z } from 'zod';
import { body, route } from '@/lib/http';
import { resolveContactToken } from '@/lib/contact-token';
import { db } from '@/lib/store';
import { nowIso } from '@/lib/utils';

const schema = z.object({ notificationId: z.string().max(80) });

/** Called by the contact's service worker when a push actually arrives on their device → "delivered". */
export const POST = route<{ token: string }>(async (req, { token }) => {
  const { contact } = await resolveContactToken(token);
  const { notificationId } = await body(req, schema);
  const n = await db().get('relay_notifications', notificationId);
  if (n && n.contactId === contact.id && n.channel === 'web_push' && n.status === 'sent') await db().update('relay_notifications', n.id, { status: 'delivered', deliveredAt: nowIso() });
  return { ok: true };
});
