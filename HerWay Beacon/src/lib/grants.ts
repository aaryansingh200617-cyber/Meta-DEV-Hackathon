import { db } from './store';
import { uid } from './crypto';
import { addEvent } from './events';
import { MAX_OVERRUN_HOURS } from './defaults';
import type { Grant, Journey } from './types';
import { addMs, nowIso } from './utils';

export const grantExpiry = (j: Pick<Journey, 'expectedArrivalAt' | 'graceMinutes'>) =>
  addMs(new Date(j.expectedArrivalAt).getTime(), j.graceMinutes * 60_000 + MAX_OVERRUN_HOURS * 3600_000);

export const isActive = (g: Grant, now = Date.now()) => !g.revokedAt && new Date(g.expiresAt).getTime() > now;

export async function createGrant(j: Journey, contactId: string, scope: Grant['scope']): Promise<Grant> {
  const existing = (await db().find('grants', { journeyId: j.id, contactId, scope })).find((g) => !g.revokedAt);
  if (existing) return existing;
  const g: Grant = { id: uid('g_'), journeyId: j.id, userId: j.userId, contactId, scope, createdAt: nowIso(), expiresAt: grantExpiry(j), revokedAt: null, revokedReason: null };
  return db().insert('grants', g);
}

export async function activeGrants(journeyId: string): Promise<Grant[]> {
  return (await db().find('grants', { journeyId })).filter((g) => isActive(g));
}

export async function hasActiveGrant(journeyId: string, contactId: string, scope: Grant['scope']): Promise<boolean> {
  return (await db().find('grants', { journeyId, contactId, scope })).some((g) => isActive(g));
}

/** Revoke every live grant of a journey. Returns how many were revoked. */
export async function revokeJourneyGrants(j: Pick<Journey, 'id' | 'userId'>, reason: NonNullable<Grant['revokedReason']>, log = true): Promise<number> {
  const live = (await db().find('grants', { journeyId: j.id })).filter((g) => !g.revokedAt);
  const at = nowIso();
  for (const g of live) await db().update('grants', g.id, { revokedAt: at, revokedReason: reason });
  if (live.length && log) {
    const contacts = new Set(live.map((g) => g.contactId)).size;
    await addEvent({ userId: j.userId, journeyId: j.id, type: 'access_revoked', message: `Access ended for ${contacts} contact${contacts === 1 ? '' : 's'} (${reason === 'journey_ended' ? 'journey ended' : reason === 'expired' ? 'access expired' : reason.replace('_', ' ')}). Live location is no longer visible to anyone but you.` });
  }
  return live.length;
}

export async function extendGrants(j: Journey) {
  const exp = grantExpiry(j);
  for (const g of (await db().find('grants', { journeyId: j.id })).filter((x) => !x.revokedAt)) await db().update('grants', g.id, { expiresAt: exp });
}
