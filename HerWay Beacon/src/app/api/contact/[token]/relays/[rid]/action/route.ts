import { z } from 'zod';
import { body, notFound, route } from '@/lib/http';
import { resolveContactToken } from '@/lib/contact-token';
import { recordRelayAction } from '@/lib/relay';

const schema = z.object({ action: z.enum(['calling', 'on_my_way', 'contacted_authorities', 'cannot_reach', 'note']), note: z.string().trim().max(280).optional() });

/** What a contact reports doing. HerWay Beacon records the claim; it cannot verify it. */
export const POST = route<{ token: string; rid: string }>(async (req, { token, rid }) => {
  const { contact } = await resolveContactToken(token);
  if (contact.status !== 'accepted') throw notFound('Request not found');
  const b = await body(req, schema);
  const ok = await recordRelayAction(rid, contact, b.action, b.note);
  if (!ok) throw notFound('Request not found');
  return { ok: true };
});
