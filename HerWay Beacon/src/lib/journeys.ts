import { db } from './store';
import { uid } from './crypto';
import { addEvent } from './events';
import { createGrant, extendGrants, grantExpiry, revokeJourneyGrants, isActive } from './grants';
import { createRelay, relayDetail, resolveRelay } from './relay';
import { haversine, projectOnPolyline } from './geo';
import { ApiError, conflict, notFound } from './http';
import { MAX_OVERRUN_HOURS } from './defaults';
import type { Journey, JourneyLocation, Place, RouteOption, TravelMode, User } from './types';
import { addMs, addSeconds, fmtDistance, nowIso } from './utils';

export interface StartJourneyInput {
  mode: TravelMode;
  origin: Place;
  destination: Place;
  route: RouteOption;
  etaMinutes: number;
  checkinIntervalS: number;
  checkinWindowS?: number;
  graceMinutes?: number;
  shareContactIds: string[];
  shareLocationContactIds: string[];
  escalationShareLocation: boolean;
  autoAlertOnMissed?: boolean;
  autoAlertOnOverdue?: boolean;
  autoAlertOnDeviation?: boolean;
  deviationEnabled: boolean;
  escalateAfterS?: number;
  simulated: boolean;
}

export async function activeJourneyFor(userId: string): Promise<Journey | null> {
  return (await db().find('journeys', { userId, status: 'active' }))[0] ?? null;
}

export async function getOwnedJourney(userId: string, id: string): Promise<Journey> {
  const j = await db().get('journeys', id);
  if (!j || j.userId !== userId) throw notFound('Journey not found');
  return j;
}

export async function startJourney(user: User, inp: StartJourneyInput): Promise<Journey> {
  if (await activeJourneyFor(user.id)) throw conflict('You already have an active journey. End it before starting another.');
  const s = user.settings;
  const contacts = await db().find('contacts', { userId: user.id });
  const sharedIds = [...new Set([...inp.shareContactIds, ...inp.shareLocationContactIds])];
  const shared = sharedIds.map((id) => {
    const c = contacts.find((x) => x.id === id);
    if (!c) throw new ApiError(400, 'bad_contact', 'One of the selected contacts does not exist');
    if (c.status !== 'accepted') throw new ApiError(400, 'contact_not_accepted', `${c.name} has not accepted the invitation yet, so cannot be given access.`);
    return { contactId: c.id, name: c.name, location: inp.shareLocationContactIds.includes(c.id) };
  });

  const started = nowIso();
  const interval = inp.checkinIntervalS;
  const j: Journey = {
    id: uid('j_'), userId: user.id, status: 'active', mode: inp.mode, origin: inp.origin, destination: inp.destination,
    route: inp.route, startedAt: started, expectedArrivalAt: addMs(started, inp.etaMinutes * 60_000),
    graceMinutes: inp.graceMinutes ?? s.graceMinutes, endedAt: null, endReason: null, overdueAt: null,
    checkinIntervalS: interval, checkinWindowS: inp.checkinWindowS ?? s.checkinWindowSeconds,
    nextCheckinDueAt: interval > 0 ? addSeconds(started, interval) : null, missedStreak: 0,
    maxMissed: s.maxMissedCheckins, autoAlertOnMissed: inp.autoAlertOnMissed ?? s.autoAlertOnMissed,
    autoAlertOnOverdue: inp.autoAlertOnOverdue ?? s.autoAlertOnOverdue, escalationShareLocation: inp.escalationShareLocation,
    deviationEnabled: inp.deviationEnabled, deviationThresholdM: s.deviationThresholdM, deviationResponseS: s.deviationResponseSeconds,
    autoAlertOnDeviation: inp.autoAlertOnDeviation ?? s.autoAlertOnDeviation, deviationState: 'on_route', deviationSince: null,
    deviationPromptExpiresAt: null, deviationSnoozeUntil: null, escalateAfterS: inp.escalateAfterS ?? s.escalateAfterSeconds,
    lastLocation: null, arrivalSuggested: false, simulated: inp.simulated, shared, summary: null, purgeAfter: null, trailPurgedAt: null,
  };
  await db().insert('journeys', j);

  await addEvent({ userId: user.id, journeyId: j.id, type: 'journey_started', actor: 'traveller', at: started, message: `Journey started: ${j.origin.name} → ${j.destination.name} (${j.route.label}, ${fmtDistance(j.route.distanceM)}). Expected arrival ${new Date(j.expectedArrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` });

  for (const sh of shared) {
    await createGrant(j, sh.contactId, 'status');
    if (sh.location) await createGrant(j, sh.contactId, 'location');
    await addEvent({ userId: user.id, journeyId: j.id, type: 'access_granted', actor: 'traveller', message: `${sh.name} can see your journey status${sh.location ? ' and live location' : ''} until the journey ends (automatic cut-off ${new Date(grantExpiry(j)).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })} at the latest).`, data: { contactId: sh.contactId } });
  }
  await db().insert('consent_log', {
    id: uid('cl_'), userId: user.id, kind: 'journey_pledge', at: started,
    detail: `Journey ${j.id}: status shared with ${shared.map((x) => x.name).join(', ') || 'nobody'}; live location with ${shared.filter((x) => x.location).map((x) => x.name).join(', ') || 'nobody'}; pre-authorised emergency location release: ${j.escalationShareLocation ? 'yes' : 'no'}.`,
  });
  return j;
}

/* ── Live location ── */

export async function recordLocation(j: Journey, loc: { lat: number; lng: number; accuracy?: number | null; simulated?: boolean }) {
  if (j.status !== 'active') throw conflict('This journey has ended.');
  const at = nowIso();
  const last: JourneyLocation = { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy ?? null, at, simulated: Boolean(loc.simulated) };
  await db().insert('locations', { id: uid('l_'), journeyId: j.id, userId: j.userId, lat: loc.lat, lng: loc.lng, accuracy: last.accuracy, at, simulated: last.simulated });
  const patch: Partial<Journey> = { lastLocation: last };
  const now = Date.now();

  // Route deviation
  if (j.deviationEnabled) {
    const pr = projectOnPolyline(loc, j.route.polyline);
    const off = pr.distanceM > j.deviationThresholdM;
    const snoozed = j.deviationSnoozeUntil && new Date(j.deviationSnoozeUntil).getTime() > now;
    if (off && j.deviationState === 'on_route' && !snoozed) {
      patch.deviationState = 'prompting';
      patch.deviationSince = at;
      patch.deviationPromptExpiresAt = addSeconds(at, j.deviationResponseS);
      await addEvent({ userId: j.userId, journeyId: j.id, type: 'deviation_detected', message: `You appear to be about ${Math.round(pr.distanceM)} m away from your selected route. Asked you to confirm you are okay.`, data: { offRouteM: Math.round(pr.distanceM) } });
    } else if (!off && j.deviationState !== 'on_route') {
      patch.deviationState = 'on_route';
      patch.deviationSince = null;
      patch.deviationPromptExpiresAt = null;
      await addEvent({ userId: j.userId, journeyId: j.id, type: 'deviation_resolved', message: 'Back on the selected route.' });
    }
  }

  // Arrival suggestion (never auto-ends: the traveller decides)
  if (!j.arrivalSuggested && haversine(loc, j.destination) < 80) {
    patch.arrivalSuggested = true;
    await addEvent({ userId: j.userId, journeyId: j.id, type: 'arrival_suggested', message: `You are within about 80 m of ${j.destination.name}. Waiting for you to confirm arrival.` });
  }
  await db().update('journeys', j.id, patch);
  return (await db().get('journeys', j.id))!;
}

/* ── Check-ins, deviation responses, ETA ── */

export async function confirmCheckin(j: Journey, quiet = false) {
  if (j.status !== 'active') throw conflict('This journey has ended.');
  const pending = (await db().find('checkins', { journeyId: j.id, status: 'pending' }))[0];
  const t = nowIso();
  if (pending) await db().update('checkins', pending.id, { status: 'confirmed', respondedAt: t });
  else await db().insert('checkins', { id: uid('c_'), journeyId: j.id, userId: j.userId, dueAt: t, windowEndsAt: t, status: 'confirmed', respondedAt: t });
  await db().update('journeys', j.id, { missedStreak: 0, nextCheckinDueAt: j.checkinIntervalS > 0 ? addSeconds(t, j.checkinIntervalS) : null });
  if (!quiet) await addEvent({ userId: j.userId, journeyId: j.id, type: 'checkin_confirmed', actor: 'traveller', message: 'Check-in confirmed: you said you are okay.' });
}

export async function respondDeviation(j: Journey, user: User, response: 'ok' | 'snooze' | 'alert') {
  if (j.status !== 'active') throw conflict('This journey has ended.');
  const t = nowIso();
  if (response === 'ok') {
    await db().update('journeys', j.id, { deviationState: 'user_ok', deviationPromptExpiresAt: null });
    await addEvent({ userId: j.userId, journeyId: j.id, type: 'deviation_response', actor: 'traveller', message: 'You confirmed you are okay and chose a different path.' });
  } else if (response === 'snooze') {
    await db().update('journeys', j.id, { deviationState: 'user_ok', deviationPromptExpiresAt: null, deviationSnoozeUntil: addMs(t, 15 * 60_000) });
    await addEvent({ userId: j.userId, journeyId: j.id, type: 'deviation_response', actor: 'traveller', message: 'You paused route-deviation prompts for 15 minutes.' });
  } else {
    await db().update('journeys', j.id, { deviationState: 'alerted', deviationPromptExpiresAt: null });
    await addEvent({ userId: j.userId, journeyId: j.id, type: 'deviation_response', actor: 'traveller', message: 'You chose to alert your contacts.' });
    await createRelay({ user, kind: 'call_me', journey: j, message: 'Left my route and would like a call.', includeLocation: true, actor: 'traveller' });
  }
}

export async function extendEta(j: Journey, minutes: number) {
  if (j.status !== 'active') throw conflict('This journey has ended.');
  const eta = addMs(j.expectedArrivalAt, minutes * 60_000);
  const next = { ...j, expectedArrivalAt: eta };
  await db().update('journeys', j.id, { expectedArrivalAt: eta, overdueAt: null });
  await extendGrants(next);
  await addEvent({ userId: j.userId, journeyId: j.id, type: 'eta_extended', actor: 'traveller', message: `Expected arrival moved ${minutes} min later.` });
}

/* ── Ending a journey (always revokes access) ── */

export async function endJourney(j: Journey, user: User, reason: 'arrived' | 'cancelled' | 'expired') {
  if (j.status !== 'active') return j;
  const t = nowIso();
  await db().update('journeys', j.id, { status: reason === 'cancelled' ? 'cancelled' : reason === 'expired' ? 'expired' : 'completed', endedAt: t, endReason: reason, lastLocation: null, nextCheckinDueAt: null, deviationState: 'on_route', deviationPromptExpiresAt: null });
  await db().deleteWhere('checkins', { journeyId: j.id, status: 'pending' });
  await addEvent({ userId: j.userId, journeyId: j.id, type: 'journey_ended', actor: reason === 'expired' ? 'system' : 'traveller', at: t, message: reason === 'arrived' ? 'Journey ended: you confirmed you arrived.' : reason === 'cancelled' ? 'Journey cancelled by you.' : `Journey closed automatically ${MAX_OVERRUN_HOURS} hours after the expected arrival.` });

  await revokeJourneyGrants(j, 'journey_ended');

  if (reason !== 'expired') {
    for (const r of await db().find('relays', { journeyId: j.id })) if (r.status === 'open' || r.status === 'acknowledged') await resolveRelay(r, 'journey_ended');
  }

  // Retention
  const s = user.settings;
  const patch: Partial<Journey> = {};
  if (!s.keepTrail) {
    const n = await db().deleteWhere('locations', { journeyId: j.id });
    patch.trailPurgedAt = t;
    if (n) await addEvent({ userId: j.userId, journeyId: j.id, type: 'location_trail_deleted', message: 'Precise location trail deleted, as set in your retention preferences.' });
  }
  if (s.retentionDays > 0) patch.purgeAfter = addMs(t, s.retentionDays * 86400_000);
  if (Object.keys(patch).length) await db().update('journeys', j.id, patch);
  return (await db().get('journeys', j.id))!;
}

/* ── Composite view for the traveller UI ── */

export async function journeyView(j: Journey) {
  const [events, relays, grants, checkins, contacts] = await Promise.all([
    db().find('events', { journeyId: j.id }, { orderBy: 'at', desc: true, limit: 200 }),
    db().find('relays', { journeyId: j.id }, { orderBy: 'createdAt', desc: true }),
    db().find('grants', { journeyId: j.id }),
    db().find('checkins', { journeyId: j.id }, { orderBy: 'dueAt' }),
    db().find('contacts', { userId: j.userId }),
  ]);
  const pending = checkins.find((c) => c.status === 'pending') ?? null;
  const trail = await db().find('locations', { journeyId: j.id }, { orderBy: 'at' });
  const now = Date.now();
  return {
    journey: j,
    serverNow: nowIso(),
    pendingCheckin: pending,
    checkinStats: { confirmed: checkins.filter((c) => c.status === 'confirmed').length, missed: checkins.filter((c) => c.status === 'missed').length },
    relays: await Promise.all(relays.map(relayDetail)),
    access: grants.map((g) => ({ ...g, contactName: contacts.find((c) => c.id === g.contactId)?.name ?? 'Contact', active: isActive(g, now) })),
    events,
    trail: trail.filter((_, i) => i % Math.max(1, Math.ceil(trail.length / 300)) === 0).map((p) => [p.lat, p.lng] as [number, number]),
    trailCount: trail.length,
  };
}
