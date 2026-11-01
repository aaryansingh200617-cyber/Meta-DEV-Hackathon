import { notFound, route } from '@/lib/http';
import { resolveContactToken } from '@/lib/contact-token';
import { acknowledgeRelay } from '@/lib/relay';

export const POST = route<{ token: string; rid: string }>(async (_req, { token, rid }) => {
  const { contact } = await resolveContactToken(token);
  if (contact.status !== 'accepted') throw notFound('Request not found');
  const r = await acknowledgeRelay(rid, contact);
  if (!r) throw notFound('Request not found');
  return { ok: true, status: r.status };
});
