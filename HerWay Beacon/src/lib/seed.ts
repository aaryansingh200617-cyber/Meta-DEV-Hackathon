import { db } from './store';
import { uid, encryptField } from './crypto';
import { DEMO_PLACES } from './routing/gazetteer';
import { demoRoutes } from './routing/demo';
import { pointAlong } from './geo';
import { freshExpiry } from './contact-token';
import type { Contact, Journey, JourneyEvent, Place, TravelMode, User } from './types';
import { addMs, nowIso } from './utils';

const place = (name: string): Place =>
  DEMO_PLACES.find((p) => p.name.toLowerCase().includes(name.toLowerCase())) ?? DEMO_PLACES[0]!;

export async function seedDemoData(user: User) {
  const store = db();
  const t = nowIso();
  const mk = (name: string, relationship: string, phone: string, tier: 1 | 2 | 3, status: Contact['status']): Contact => ({
    id: uid('c_'), userId: user.id, name, relationship, phoneEnc: encryptField(phone), emailEnc: null, tier, status,
    tokenVersion: 1, tokenExpiresAt: freshExpiry(), consentedAt: status === 'accepted' ? t : null, seeded: true, createdAt: t,
  });
  const contacts = [
    mk('Anita Rao', 'Mother', '+91 90000 00001', 1, 'accepted'),
    mk('Meera Iyer', 'Friend', '+91 90000 00002', 1, 'accepted'),
    mk('Rohan Rao', 'Cousin', '+91 90000 00003', 2, 'accepted'),
    mk('Kavya Rao', 'Sister', '+91 90000 00004', 3, 'pending'),
  ];
  for (const c of contacts) await store.insert('contacts', c);
  const [mom, friend] = contacts as [Contact, Contact];

  const past = async (opts: {
    daysAgo: number; hour: number; from: string; to: string; mode: TravelMode; minutes: number; checkins: number; missed?: number;
    deviation?: boolean; relay?: { afterS: number; by: Contact; action: 'calling' | 'on_my_way' }; trail?: boolean; share: Contact[];
  }) => {
    const d = new Date(); d.setDate(d.getDate() - opts.daysAgo); d.setHours(opts.hour, 12, 0, 0);
    const start = d.toISOString();
    const end = addMs(start, opts.minutes * 60_000);
    const o = place(opts.from); const dest = place(opts.to);
    const route = demoRoutes(o, dest, opts.mode)[1]!;
    const jid = uid('j_');
    const j: Journey = {
      id: jid, userId: user.id, status: 'completed', mode: opts.mode, origin: o, destination: dest, route, startedAt: start,
      expectedArrivalAt: addMs(start, (opts.minutes + 3) * 60_000), graceMinutes: 10, endedAt: end, endReason: 'arrived', overdueAt: null,
      checkinIntervalS: 600, checkinWindowS: 120, nextCheckinDueAt: null, missedStreak: 0, maxMissed: 2, autoAlertOnMissed: false, autoAlertOnOverdue: false,
      escalationShareLocation: false, deviationEnabled: true, deviationThresholdM: 150, deviationResponseS: 90, autoAlertOnDeviation: false,
      deviationState: 'on_route', deviationSince: null, deviationPromptExpiresAt: null, deviationSnoozeUntil: null, escalateAfterS: 120,
      lastLocation: null, arrivalSuggested: true, simulated: true, shared: opts.share.map((c, i) => ({ contactId: c.id, name: c.name, location: i === 0 })),
      summary: null, purgeAfter: addMs(end, 30 * 86400_000), trailPurgedAt: null,
    };
    await store.insert('journeys', j);
    const ev = async (min: number, type: JourneyEvent['type'], message: string, actor: JourneyEvent['actor'] = 'system', data?: Record<string, unknown>) =>
      store.insert('events', { id: uid('ev_'), userId: user.id, journeyId: jid, at: addMs(start, min * 60_000), type, actor, message, data });
    await ev(0, 'journey_started', `Journey started: ${o.name} → ${dest.name} (${route.label}). (Sample history)`, 'traveller');
    for (const [i, c] of opts.share.entries()) {
      await store.insert('grants', { id: uid('g_'), journeyId: jid, userId: user.id, contactId: c.id, scope: 'status', createdAt: start, expiresAt: addMs(end, 6 * 3600_000), revokedAt: end, revokedReason: 'journey_ended' });
      if (i === 0) await store.insert('grants', { id: uid('g_'), journeyId: jid, userId: user.id, contactId: c.id, scope: 'location', createdAt: start, expiresAt: addMs(end, 6 * 3600_000), revokedAt: end, revokedReason: 'journey_ended' });
      await ev(0, 'access_granted', `${c.name} can see your journey status${i === 0 ? ' and live location' : ''} until the journey ends.`, 'traveller');
    }
    const step = Math.max(2, Math.floor(opts.minutes / (opts.checkins + 1)));
    for (let i = 1; i <= opts.checkins; i++) {
      await store.insert('checkins', { id: uid('c_'), journeyId: jid, userId: user.id, dueAt: addMs(start, i * step * 60_000), windowEndsAt: addMs(start, (i * step + 2) * 60_000), status: 'confirmed', respondedAt: addMs(start, (i * step + 0.5) * 60_000) });
      await ev(i * step, 'checkin_confirmed', 'Check-in confirmed: you said you are okay.', 'traveller');
    }
    if (opts.missed) {
      await store.insert('checkins', { id: uid('c_'), journeyId: jid, userId: user.id, dueAt: addMs(start, (opts.checkins + 1) * step * 60_000), windowEndsAt: addMs(start, ((opts.checkins + 1) * step + 2) * 60_000), status: 'missed', respondedAt: null });
      await ev((opts.checkins + 1) * step + 2, 'checkin_missed', 'Check-in missed (1 in a row).');
    }
    if (opts.deviation) {
      await ev(Math.floor(opts.minutes / 2), 'deviation_detected', 'You appear to be about 210 m away from your selected route. Asked you to confirm you are okay.');
      await ev(Math.floor(opts.minutes / 2) + 1, 'deviation_response', 'You confirmed you are okay and chose a different path.', 'traveller');
      await ev(Math.floor(opts.minutes / 2) + 4, 'deviation_resolved', 'Back on the selected route.');
    }
    if (opts.relay) {
      const rid = uid('r_'); const at = Math.floor(opts.minutes / 2) + 2;
      const rt = addMs(start, at * 60_000);
      await store.insert('relays', { id: rid, userId: user.id, journeyId: jid, kind: 'call_me', message: 'Please call me, I feel uneasy.', status: 'resolved', groups: [[mom.id, friend.id]], step: 0, escalateAfterS: 120, lastStepAt: rt, createdAt: rt, resolvedAt: end, includeLocation: true });
      for (const c of [mom, friend]) {
        const ack = c.id === opts.relay.by.id;
        await store.insert('relay_notifications', { id: uid('n_'), relayId: rid, userId: user.id, contactId: c.id, step: 0, channel: 'in_app', status: ack ? 'acknowledged' : 'delivered', detail: null, sentAt: rt, deliveredAt: addMs(rt, 9_000), acknowledgedAt: ack ? addMs(rt, opts.relay.afterS * 1000) : null });
        await store.insert('relay_notifications', { id: uid('n_'), relayId: rid, userId: user.id, contactId: c.id, step: 0, channel: 'sms_sim', status: 'simulated', detail: 'SIMULATED — no SMS/voice provider is configured, nothing was sent', sentAt: rt, deliveredAt: null, acknowledgedAt: null });
      }
      await store.insert('relay_actions', { id: uid('ra_'), relayId: rid, userId: user.id, contactId: opts.relay.by.id, action: opts.relay.action, note: null, at: addMs(rt, (opts.relay.afterS + 5) * 1000) });
      await ev(at, 'relay_requested', 'Call request created · live location included.', 'traveller', { relayId: rid });
      await ev(at, 'relay_sent', `Notified ${mom.name} and ${friend.name}.`, 'system', { relayId: rid });
      await ev(at + 1, 'relay_acknowledged', `${opts.relay.by.name} acknowledged your request after ${opts.relay.afterS} s.`, 'contact', { relayId: rid });
      await ev(at + 1, 'relay_action', `${opts.relay.by.name} ${opts.relay.action === 'calling' ? 'is calling you now' : 'says they are on their way'} (reported by contact, not verified).`, 'contact', { relayId: rid });
      await ev(opts.minutes - 1, 'relay_resolved', 'Help request closed because you ended the journey.', 'system', { relayId: rid });
    }
    await ev(opts.minutes, 'journey_ended', 'Journey ended: you confirmed you arrived.', 'traveller');
    await ev(opts.minutes, 'access_revoked', `Access ended for ${opts.share.length} contacts (journey ended). Live location is no longer visible to anyone but you.`);
    if (opts.trail) {
      const n = 24;
      for (let i = 0; i <= n; i++) {
        const p = pointAlong(route.polyline, (route.distanceM * i) / n);
        await store.insert('locations', { id: uid('l_'), journeyId: jid, userId: user.id, lat: p.lat, lng: p.lng, accuracy: 12, at: addMs(start, (opts.minutes * 60_000 * i) / n), simulated: true });
      }
    }
  };

  await past({ daysAgo: 1, hour: 19, from: 'Indiranagar', to: 'Koramangala', mode: 'drive', minutes: 24, checkins: 2, share: [mom, friend], trail: true });
  await past({ daysAgo: 5, hour: 21, from: 'MG Road', to: 'Home', mode: 'walk', minutes: 38, checkins: 3, missed: 1, deviation: true, relay: { afterS: 48, by: friend, action: 'calling' }, share: [mom, friend], trail: true });
  await past({ daysAgo: 11, hour: 18, from: 'HSR Layout', to: 'Jayanagar', mode: 'transit', minutes: 33, checkins: 2, share: [friend], trail: false });
}
