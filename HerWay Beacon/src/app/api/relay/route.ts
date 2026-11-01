import { z } from 'zod';
import { body, rateLimit, route, badRequest } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { activeJourneyFor, getOwnedJourney } from '@/lib/journeys';
import { createRelay, relayDetail } from '@/lib/relay';
import { maybeTick } from '@/lib/engine';

const schema = z.object({
  kind: z.enum(['call_me', 'urgent']),
  message: z.string().trim().max(280).optional(),
  journeyId: z.string().optional(),
  contactIds: z.array(z.string()).max(12).optional(),
  mode: z.enum(['ripple', 'all']).default('ripple'),
  /** Explicit consent captured at the moment of the request */
  includeLocation: z.boolean().default(false),
});

/** HerWay Relay: works with no AI, no maps and no network services other than this server. */
export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`relay:${user.id}`, 8, 60_000);
  const b = await body(req, schema);
  const journey = b.journeyId ? await getOwnedJourney(user.id, b.journeyId) : await activeJourneyFor(user.id);
  if (journey && journey.status !== 'active' && b.includeLocation) throw badRequest('Location cannot be shared for a finished journey.');

  // Idempotency: a double-tap within 45 s returns the request already open
  const recent = (await db().find('relays', { userId: user.id, status: 'open', kind: b.kind })).find((r) => Date.now() - new Date(r.createdAt).getTime() < 45_000);
  if (recent) return { relay: await relayDetail(recent), duplicate: true };

  const relay = await createRelay({
    user, kind: b.kind, journey: journey?.status === 'active' ? journey : null, message: b.message, contactIds: b.contactIds,
    mode: b.mode, includeLocation: b.includeLocation, actor: 'traveller',
  });
  return { relay: await relayDetail(relay), emergencyNumber: user.settings.emergencyNumber };
});

export const GET = route(async () => {
  const user = await requireUser();
  await maybeTick();
  const open = (await db().find('relays', { userId: user.id }, { orderBy: 'createdAt', desc: true, limit: 10 }));
  return { relays: await Promise.all(open.map(relayDetail)) };
});
