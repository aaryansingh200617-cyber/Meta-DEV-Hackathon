import { db } from './store';
import { uid } from './crypto';
import { addEvent } from './events';
import { createGrant } from './grants';
import { dispatchToContact, relayHeadline } from './notify';
import type { Contact, Journey, Relay, RelayActionKind, RelayKind, RelayNotification, User } from './types';
import { addSeconds, fmtDuration, nowIso } from './utils';

export const isEligible = (c: Contact, now = Date.now()) => c.status === 'accepted' && new Date(c.tokenExpiresAt).getTime() > now;

export async function eligibleContacts(userId: string) {
  return (await db().find('contacts', { userId })).filter((c) => isEligible(c));
}

export interface CreateRelayInput {
  user: User;
  kind: RelayKind;
  journey?: Journey | null;
  message?: string;
  contactIds?: string[];
  /** ripple = notify by tier and escalate; all = notify everyone selected at once */
  mode?: 'ripple' | 'all';
  includeLocation?: boolean;
  actor: 'traveller' | 'system';
}

export async function createRelay(inp: CreateRelayInput): Promise<Relay> {
  const { user, journey } = inp;
  const mode = inp.mode ?? 'ripple';
  let pool = await eligibleContacts(user.id);
  if (inp.contactIds?.length) pool = pool.filter((c) => inp.contactIds!.includes(c.id));
  pool.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

  let groups: string[][] = [];
  if (pool.length) {
    if (mode === 'all') groups = [pool.map((c) => c.id)];
    else {
      for (const tier of [1, 2, 3] as const) {
        const g = pool.filter((c) => c.tier === tier).map((c) => c.id);
        if (g.length) groups.push(g);
      }
    }
  }

  const t = nowIso();
  const relay: Relay = {
    id: uid('r_'), userId: user.id, journeyId: journey?.id ?? null, kind: inp.kind,
    message: (inp.message ?? '').slice(0, 280), status: groups.length ? 'open' : 'unanswered', groups, step: 0,
    escalateAfterS: journey?.escalateAfterS ?? user.settings.escalateAfterSeconds, lastStepAt: t, createdAt: t,
    resolvedAt: null, includeLocation: Boolean(inp.includeLocation && journey),
  };
  await db().insert('relays', relay);

  const label = inp.kind === 'call_me' ? 'Call request' : inp.kind === 'urgent' ? 'Urgent help request' : 'Automatic alert';
  await addEvent({
    userId: user.id, journeyId: journey?.id ?? null, type: 'relay_requested', actor: inp.actor,
    message: `${label} created${inp.actor === 'system' ? ' by the journey guardian' : ''}${relay.includeLocation ? ' · live location included' : ''}.`,
    data: { relayId: relay.id, kind: inp.kind },
  });

  if (!groups.length) {
    await addEvent({ userId: user.id, journeyId: journey?.id ?? null, type: 'relay_unanswered', message: 'No accepted trusted contacts are available to notify. Call your local emergency number or someone nearby directly.', data: { relayId: relay.id } });
    return relay;
  }
  await dispatchGroup(relay, user, 0, journey ?? null);
  return (await db().get('relays', relay.id))!;
}

async function dispatchGroup(relay: Relay, user: User, step: number, journey: Journey | null) {
  const ids = relay.groups[step] ?? [];
  const contacts = (await Promise.all(ids.map((id) => db().get('contacts', id)))).filter((c): c is Contact => !!c);
  for (const c of contacts) {
    if (relay.includeLocation && journey && journey.status === 'active') {
      await createGrant(journey, c.id, 'status');
      const had = (await db().find('grants', { journeyId: journey.id, contactId: c.id, scope: 'location' })).some((g) => !g.revokedAt);
      await createGrant(journey, c.id, 'location');
      if (!had) await addEvent({ userId: user.id, journeyId: journey.id, type: 'access_granted', message: `Live location shared with ${c.name} until the journey ends (included with your help request).`, data: { contactId: c.id } });
    }
    const notifs = await dispatchToContact(relay, c, user, step);
    const summary = notifs.map((n) => `${n.channel === 'in_app' ? 'in-app' : n.channel === 'web_push' ? 'push' : 'SMS'}: ${n.status}`).join(', ');
    await addEvent({ userId: user.id, journeyId: relay.journeyId, type: 'relay_sent', message: `Notified ${c.name} (${summary}).`, data: { relayId: relay.id, contactId: c.id, headline: relayHeadline(relay.kind, user.name) } });
  }
  await db().update('relays', relay.id, { step, lastStepAt: nowIso() });
}

export async function acknowledgeRelay(relayId: string, contact: Contact) {
  const relay = await db().get('relays', relayId);
  if (!relay || relay.userId !== contact.userId) return null;
  const t = nowIso();
  const notifs = (await db().find('relay_notifications', { relayId, contactId: contact.id }));
  if (!notifs.length) return null; // contact was never notified for this relay: cannot acknowledge it
  const already = notifs.some((n) => n.acknowledgedAt);
  for (const n of notifs) {
    if (['sent', 'delivered', 'queued'].includes(n.status)) await db().update('relay_notifications', n.id, { status: 'acknowledged', acknowledgedAt: t, deliveredAt: n.deliveredAt ?? t });
    else await db().update('relay_notifications', n.id, { acknowledgedAt: t });
  }
  if (!already) {
    const secs = Math.max(0, Math.round((Date.now() - new Date(relay.createdAt).getTime()) / 1000));
    await addEvent({ userId: relay.userId, journeyId: relay.journeyId, type: 'relay_acknowledged', actor: 'contact', message: `${contact.name} acknowledged your request after ${fmtDuration(secs)}.`, data: { relayId, contactId: contact.id, afterSeconds: secs } });
  }
  if (relay.status === 'open' || relay.status === 'unanswered') await db().update('relays', relayId, { status: 'acknowledged' });
  return db().get('relays', relayId);
}

const ACTION_TEXT: Record<RelayActionKind, string> = {
  calling: 'is calling you now',
  on_my_way: 'says they are on their way',
  contacted_authorities: 'says they contacted the authorities',
  cannot_reach: 'could not reach you',
  note: 'sent a note',
};

export async function recordRelayAction(relayId: string, contact: Contact, action: RelayActionKind, note?: string) {
  const relay = await db().get('relays', relayId);
  if (!relay || relay.userId !== contact.userId) return null;
  const notified = (await db().find('relay_notifications', { relayId, contactId: contact.id })).length > 0;
  if (!notified) return null;
  await db().insert('relay_actions', { id: uid('ra_'), relayId, userId: relay.userId, contactId: contact.id, action, note: note?.slice(0, 280) || null, at: nowIso() });
  await addEvent({
    userId: relay.userId, journeyId: relay.journeyId, type: 'relay_action', actor: 'contact',
    // Contact statements are reported, never verified by HerWay Beacon.
    message: `${contact.name} ${ACTION_TEXT[action]}${note ? `: “${note.slice(0, 120)}”` : ''} (reported by contact, not verified).`,
    data: { relayId, contactId: contact.id, action },
  });
  await acknowledgeRelay(relayId, contact);
  return true;
}

/** Traveller closes the request ("I'm safe") — stops escalation. */
export async function resolveRelay(relay: Relay, reason: 'traveller_safe' | 'journey_ended' | 'cancelled') {
  if (relay.status === 'resolved' || relay.status === 'cancelled') return;
  await db().update('relays', relay.id, { status: reason === 'cancelled' ? 'cancelled' : 'resolved', resolvedAt: nowIso() });
  await addEvent({ userId: relay.userId, journeyId: relay.journeyId, type: 'relay_resolved', actor: reason === 'journey_ended' ? 'system' : 'traveller', message: reason === 'journey_ended' ? 'Help request closed because you ended the journey.' : reason === 'cancelled' ? 'Help request cancelled by you.' : 'You marked yourself safe — help request closed.', data: { relayId: relay.id } });
}

/** Engine hook: move an unanswered relay to its next tier, or give up and say so honestly. */
export async function escalateIfDue(relay: Relay, now = Date.now()) {
  if (relay.status !== 'open') return;
  if (now < new Date(addSeconds(relay.lastStepAt, relay.escalateAfterS)).getTime()) return;
  const user = await db().get('users', relay.userId);
  if (!user) return;
  const journey = relay.journeyId ? await db().get('journeys', relay.journeyId) : null;
  const next = relay.step + 1;
  if (next < relay.groups.length) {
    const names = (await Promise.all(relay.groups[next]!.map((id) => db().get('contacts', id)))).filter(Boolean).map((c) => c!.name).join(', ');
    await addEvent({ userId: user.id, journeyId: relay.journeyId, type: 'relay_escalated', message: `Nobody acknowledged within ${fmtDuration(relay.escalateAfterS)} — escalating to ${names}.`, data: { relayId: relay.id, step: next } });
    await dispatchGroup(relay, user, next, journey);
  } else {
    await db().update('relays', relay.id, { status: 'unanswered' });
    await addEvent({ userId: user.id, journeyId: relay.journeyId, type: 'relay_unanswered', message: `No trusted contact acknowledged after ${fmtDuration(relay.escalateAfterS)} at the last step. HerWay Beacon has NOT contacted emergency services — call ${user.settings.emergencyNumber} or reach someone nearby directly.`, data: { relayId: relay.id } });
  }
}

export async function relayDetail(relay: Relay) {
  const [notifs, actions, contacts] = await Promise.all([
    db().find('relay_notifications', { relayId: relay.id }, { orderBy: 'sentAt' }),
    db().find('relay_actions', { relayId: relay.id }, { orderBy: 'at' }),
    db().find('contacts', { userId: relay.userId }),
  ]);
  const name = (id: string) => contacts.find((c) => c.id === id)?.name ?? 'Contact';
  const ids = [...new Set(relay.groups.flat())];
  return {
    ...relay,
    contacts: ids.map((id) => {
      const mine = notifs.filter((n: RelayNotification) => n.contactId === id);
      const step = relay.groups.findIndex((g) => g.includes(id));
      return {
        contactId: id, name: name(id), step, notified: mine.length > 0,
        acknowledgedAt: mine.find((n) => n.acknowledgedAt)?.acknowledgedAt ?? null,
        channels: mine.map((n) => ({ channel: n.channel, status: n.status, detail: n.detail, sentAt: n.sentAt, deliveredAt: n.deliveredAt })),
      };
    }),
    actions: actions.map((a) => ({ ...a, contactName: name(a.contactId) })),
  };
}
