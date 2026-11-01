import { NextRequest } from 'next/server';
import { notFound, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { freshExpiry, makeContactToken } from '@/lib/contact-token';

async function owned(userId: string, id: string) {
  const c = await db().get('contacts', id);
  if (!c || c.userId !== userId) throw notFound('Contact not found');
  return c;
}
const origin = (req: NextRequest) => process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || req.nextUrl.origin;

/** Show the current access link (owner only). */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const c = await owned(user.id, id);
  if (c.status === 'revoked' || c.status === 'declined') return { url: null, status: c.status };
  return { url: `${origin(req)}/c/${makeContactToken(c)}`, expiresAt: c.tokenExpiresAt, status: c.status };
});

/** Issue a fresh link: invalidates every older link and restarts the 30-day expiry. Re-invites revoked/declined contacts (they must consent again). */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const c = await owned(user.id, id);
  const status = c.status === 'revoked' || c.status === 'declined' ? 'pending' : c.status;
  const next = await db().update('contacts', id, { tokenVersion: c.tokenVersion + 1, tokenExpiresAt: freshExpiry(), status, consentedAt: status === 'pending' ? null : c.consentedAt });
  return { url: `${origin(req)}/c/${makeContactToken(next!)}`, expiresAt: next!.tokenExpiresAt, status };
});
