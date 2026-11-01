import { db } from './store';
import { addEvent } from './events';
import { isActive } from './grants';
import { relayHeadline } from './notify';
import type { Contact, LatLngTuple, RelayKind, RelayStatus, User } from './types';

export interface ShareView {
  journeyId: string; origin: string; destination: string; mode: string; routeLabel: string; startedAt: string; expectedArrivalAt: string; overdue: boolean;
  checkin: { enabled: boolean; lastConfirmedAt: string | null; awaitingResponse: boolean; missedInARow: number };
  deviation: boolean; accessEndsAt: string; scope: { status: boolean; location: boolean };
  location: { lat: number; lng: number; at: string; accuracy: number | null; simulated: boolean } | null;
  route: { polyline: LatLngTuple[]; destination: { lat: number; lng: number } } | null;
}
export interface EndedView { journeyId: string; origin: string; destination: string; endedAt: string; accessEndedAt: string; reason: string | null }
export interface RelayView {
  id: string; kind: RelayKind; headline: string; message: string; status: RelayStatus; createdAt: string; journeyId: string | null; acknowledged: boolean;
  myActions: { action: string; note: string | null; at: string }[]; locationVisible: boolean; resolvedAt: string | null; emergencyNote: string;
}
import { nowIso } from './utils';

/**
 * What a trusted contact may see. Everything is derived from ACTIVE grants at request time:
 * once a journey ends (or a grant expires/revokes) the location simply stops being returned.
 */
export async function contactDashboard(contact: Contact, traveller: User) {
  const now = Date.now();
  const first = traveller.name.split(/\s+/)[0] ?? traveller.name;
  const grants = (await db().find('grants', { contactId: contact.id }));
  const byJourney = new Map<string, typeof grants>();
  for (const g of grants) byJourney.set(g.journeyId, [...(byJourney.get(g.journeyId) ?? []), g]);

  const shares: ShareView[] = [];
  const ended: EndedView[] = [];
  for (const [journeyId, gs] of byJourney) {
    const j = await db().get('journeys', journeyId);
    if (!j) continue;
    const live = gs.filter((g) => isActive(g, now));
    const hasStatus = live.some((g) => g.scope === 'status');
    const hasLoc = live.some((g) => g.scope === 'location');
    if (j.status === 'active' && hasStatus) {
      const lastCheck = (await db().find('checkins', { journeyId, status: 'confirmed' }, { orderBy: 'respondedAt', desc: true, limit: 1 }))[0];
      const pending = (await db().find('checkins', { journeyId, status: 'pending' }))[0];
      shares.push({
        journeyId, origin: j.origin.name, destination: j.destination.name, mode: j.mode, routeLabel: j.route.label,
        startedAt: j.startedAt, expectedArrivalAt: j.expectedArrivalAt, overdue: Boolean(j.overdueAt),
        checkin: { enabled: j.checkinIntervalS > 0, lastConfirmedAt: lastCheck?.respondedAt ?? null, awaitingResponse: Boolean(pending), missedInARow: j.missedStreak },
        deviation: j.deviationState === 'prompting' || j.deviationState === 'unanswered' || j.deviationState === 'alerted',
        accessEndsAt: live.reduce((m, g) => (g.expiresAt > m ? g.expiresAt : m), live[0]!.expiresAt),
        scope: { status: true, location: hasLoc },
        // Location and route geometry are only returned while a LOCATION grant is live
        location: hasLoc && j.lastLocation ? { lat: j.lastLocation.lat, lng: j.lastLocation.lng, at: j.lastLocation.at, accuracy: j.lastLocation.accuracy, simulated: j.lastLocation.simulated } : null,
        route: hasLoc ? { polyline: j.route.polyline, destination: { lat: j.destination.lat, lng: j.destination.lng } } : null,
      });
    } else {
      const revokedAt = gs.map((g) => g.revokedAt).filter(Boolean).sort().pop();
      const endedAt = j.endedAt ?? revokedAt;
      if (endedAt && new Date(endedAt).getTime() > now - 24 * 3600_000) {
        ended.push({ journeyId, origin: j.origin.name, destination: j.destination.name, endedAt, accessEndedAt: revokedAt ?? endedAt, reason: j.endReason });
      }
    }
  }

  // Help requests addressed to this contact (last 48h)
  const notifs = await db().find('relay_notifications', { contactId: contact.id });
  const relayIds = [...new Set(notifs.map((n) => n.relayId))];
  const relays: RelayView[] = [];
  for (const id of relayIds) {
    const r = await db().get('relays', id);
    if (!r || new Date(r.createdAt).getTime() < now - 48 * 3600_000) continue;
    const mine = notifs.filter((n) => n.relayId === id);
    if (mine.some((n) => n.channel === 'in_app' && n.status === 'sent')) {
      for (const n of mine) if (n.status === 'sent' && n.channel === 'in_app') await db().update('relay_notifications', n.id, { status: 'delivered', deliveredAt: nowIso() });
      await addEvent({ userId: r.userId, journeyId: r.journeyId, type: 'relay_delivered', actor: 'contact', message: `${contact.name} opened your request on their dashboard.`, data: { relayId: id, contactId: contact.id } });
    }
    const actions = await db().find('relay_actions', { relayId: id, contactId: contact.id }, { orderBy: 'at' });
    const j = r.journeyId ? await db().get('journeys', r.journeyId) : null;
    const hasLoc = Boolean(j && j.status === 'active' && (await db().find('grants', { journeyId: j.id, contactId: contact.id, scope: 'location' })).some((g) => isActive(g, now)));
    relays.push({
      id, kind: r.kind, headline: relayHeadline(r.kind, first), message: r.message, status: r.status, createdAt: r.createdAt, journeyId: r.journeyId,
      acknowledged: mine.some((n) => n.acknowledgedAt), myActions: actions.map((a) => ({ action: a.action, note: a.note, at: a.at })),
      locationVisible: hasLoc, resolvedAt: r.resolvedAt,
      emergencyNote: 'HerWay Beacon does not contact police or emergency services. If you believe she is in danger, call your local emergency number yourself.',
    });
  }
  relays.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    serverNow: nowIso(),
    contact: { id: contact.id, name: contact.name, relationship: contact.relationship, status: contact.status, consentedAt: contact.consentedAt, linkExpiresAt: contact.tokenExpiresAt },
    traveller: { firstName: first, emergencyNumber: traveller.settings.emergencyNumber },
    shares, ended, relays,
  };
}
