import { body, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { encryptField, uid } from '@/lib/crypto';
import { contactSchema } from '@/lib/schemas';
import { freshExpiry } from '@/lib/contact-token';
import { presentContact } from '@/lib/account';
import { nowIso } from '@/lib/utils';
import type { Contact } from '@/lib/types';

export const GET = route(async () => {
  const user = await requireUser();
  const contacts = (await db().find('contacts', { userId: user.id }, { orderBy: 'tier' }));
  const out = await Promise.all(contacts.map(async (c) => presentContact(c, (await db().find('push_subscriptions', { contactId: c.id })).length)));
  return { contacts: out };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const b = await body(req, contactSchema);
  const count = (await db().find('contacts', { userId: user.id })).length;
  if (count >= 12) return Response.json({ error: { code: 'limit', message: 'You can have up to 12 trusted contacts.' } }, { status: 400 });
  const c: Contact = {
    id: uid('c_'), userId: user.id, name: b.name, relationship: b.relationship, phoneEnc: encryptField(b.phone), emailEnc: encryptField(b.email),
    tier: b.tier, status: 'pending', tokenVersion: 1, tokenExpiresAt: freshExpiry(), consentedAt: null, seeded: false, createdAt: nowIso(),
  };
  await db().insert('contacts', c);
  return { contact: presentContact(c) };
});
