import { db } from './store';
import { sign, verifySig } from './crypto';
import { ApiError } from './http';
import { CONTACT_LINK_DAYS } from './defaults';
import type { Contact, User } from './types';
import { addMs } from './utils';

/**
 * Trusted contacts do not hold accounts. They hold a signed, expiring, revocable link:
 *   <contactId>.<tokenVersion>.<expiryEpochSec>.<hmac>
 * Nothing secret is stored in the database; bumping `tokenVersion` kills every older link.
 * Authorization for what the link can SEE is decided per request from active grants.
 */
export function makeContactToken(c: Pick<Contact, 'id' | 'tokenVersion' | 'tokenExpiresAt'>): string {
  const exp = Math.floor(new Date(c.tokenExpiresAt).getTime() / 1000);
  const payload = `${c.id}.${c.tokenVersion}.${exp}`;
  return `${payload}.${sign(payload, 'contact')}`;
}

export const freshExpiry = () => addMs(Date.now(), CONTACT_LINK_DAYS * 86400_000);

export async function resolveContactToken(token: string): Promise<{ contact: Contact; traveller: User }> {
  const bad = new ApiError(403, 'invalid_link', 'This link is invalid or has expired. Ask the traveller to send a new one.');
  const parts = token.split('.');
  if (parts.length !== 4) throw bad;
  const [id, ver, exp, sig] = parts as [string, string, string, string];
  if (!verifySig(`${id}.${ver}.${exp}`, sig, 'contact')) throw bad;
  if (Number(exp) * 1000 < Date.now()) throw bad;
  const contact = await db().get('contacts', id);
  if (!contact || contact.tokenVersion !== Number(ver)) throw bad;
  if (new Date(contact.tokenExpiresAt).getTime() < Date.now()) throw bad;
  if (contact.status === 'revoked' || contact.status === 'declined') throw new ApiError(403, 'access_withdrawn', 'This access is no longer active.');
  const traveller = await db().get('users', contact.userId);
  if (!traveller) throw bad;
  return { contact, traveller };
}
