import { z } from 'zod';
import { body, route } from '@/lib/http';
import { resolveContactToken } from '@/lib/contact-token';
import { db } from '@/lib/store';
import { uid } from '@/lib/crypto';
import { nowIso } from '@/lib/utils';
import { addEvent } from '@/lib/events';

const schema = z.object({ decision: z.enum(['accept', 'decline']) });

/** The contact's own explicit consent: accept the role, or decline / step down at any time. */
export const POST = route<{ token: string }>(async (req, { token }) => {
  const { contact, traveller } = await resolveContactToken(token);
  const { decision } = await body(req, schema);
  const t = nowIso();
  if (decision === 'accept') {
    await db().update('contacts', contact.id, { status: 'accepted', consentedAt: t });
    await db().insert('consent_log', { id: uid('cl_'), userId: traveller.id, kind: 'contact_accepted', detail: `${contact.name} accepted the trusted-contact role`, at: t });
  } else {
    await db().update('contacts', contact.id, { status: 'declined', consentedAt: null });
    for (const g of (await db().find('grants', { contactId: contact.id })).filter((x) => !x.revokedAt)) {
      await db().update('grants', g.id, { revokedAt: t, revokedReason: 'user' });
      await addEvent({ userId: traveller.id, journeyId: g.journeyId, type: 'access_revoked', actor: 'contact', message: `${contact.name} stepped down — their access has ended.` });
    }
    await db().deleteWhere('push_subscriptions', { contactId: contact.id });
    await db().insert('consent_log', { id: uid('cl_'), userId: traveller.id, kind: 'contact_declined', detail: `${contact.name} declined / stepped down`, at: t });
  }
  return { ok: true, status: decision === 'accept' ? 'accepted' : 'declined' };
});
