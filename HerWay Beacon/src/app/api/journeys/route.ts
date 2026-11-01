import { z } from 'zod';
import { body, badRequest, rateLimit, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { compareRoutes } from '@/lib/routing';
import { startJourney } from '@/lib/journeys';
import { modeSchema, placeSchema } from '@/lib/schemas';
import { maybeTick } from '@/lib/engine';

const startSchema = z.object({
  origin: placeSchema,
  destination: placeSchema,
  mode: modeSchema,
  routeId: z.string().min(1).max(60),
  etaMinutes: z.number().int().min(1).max(720),
  checkinIntervalS: z.number().int().min(0).max(7200).refine((n) => n === 0 || n >= 15, 'Check-in interval must be at least 15 seconds'),
  shareContactIds: z.array(z.string()).max(12).default([]),
  shareLocationContactIds: z.array(z.string()).max(12).default([]),
  escalationShareLocation: z.boolean().default(false),
  deviationEnabled: z.boolean().default(true),
  autoAlertOnMissed: z.boolean().optional(),
  autoAlertOnOverdue: z.boolean().optional(),
  autoAlertOnDeviation: z.boolean().optional(),
  simulated: z.boolean().default(false),
  /** Compress timers so the full escalation flow can be demonstrated in a couple of minutes. */
  demoTimers: z.boolean().default(false),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm the journey pledge before starting' }) }),
});

export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`jstart:${user.id}`, 10, 60_000);
  const b = await body(req, startSchema);
  const { routes } = await compareRoutes(b.origin, b.destination, b.mode);
  const chosen = routes.find((r) => r.id === b.routeId);
  if (!chosen) throw badRequest('That route is no longer available. Compare routes again.');
  const j = await startJourney(user, {
    mode: b.mode, origin: b.origin, destination: b.destination, route: chosen, etaMinutes: b.etaMinutes,
    checkinIntervalS: b.checkinIntervalS, shareContactIds: b.shareContactIds, shareLocationContactIds: b.shareLocationContactIds,
    escalationShareLocation: b.escalationShareLocation, deviationEnabled: b.deviationEnabled,
    autoAlertOnMissed: b.autoAlertOnMissed, autoAlertOnOverdue: b.autoAlertOnOverdue, autoAlertOnDeviation: b.autoAlertOnDeviation,
    simulated: b.simulated, ...(b.demoTimers ? { checkinWindowS: 20, graceMinutes: 1, escalateAfterS: 20 } : {}),
  });
  return { journey: j };
});

/** Journey history (summaries only). */
export const GET = route(async () => {
  const user = await requireUser();
  await maybeTick();
  const journeys = await db().find('journeys', { userId: user.id }, { orderBy: 'startedAt', desc: true });
  const items = await Promise.all(journeys.map(async (j) => {
    const [relays, checkins] = await Promise.all([db().find('relays', { journeyId: j.id }), db().find('checkins', { journeyId: j.id })]);
    return {
      id: j.id, status: j.status, mode: j.mode, origin: j.origin.name, destination: j.destination.name, startedAt: j.startedAt, endedAt: j.endedAt,
      endReason: j.endReason, routeLabel: j.route.label, distanceM: j.route.distanceM, simulated: j.route.simulated, purgeAfter: j.purgeAfter,
      sharedWith: j.shared.map((s) => s.name),
      counts: { relays: relays.length, confirmed: checkins.filter((c) => c.status === 'confirmed').length, missed: checkins.filter((c) => c.status === 'missed').length },
    };
  }));
  return { journeys: items };
});
