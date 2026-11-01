import { db } from './store';
import { deleteAuthUser } from './auth';
import { decryptField } from './crypto';
import { deleteJourneyData } from './engine';
import type { Contact } from './types';

/** Permanently removes everything we hold about a user. Contact links stop working immediately. */
export async function deleteAccountData(userId: string) {
  const store = db();
  for (const j of await store.find('journeys', { userId })) await deleteJourneyData(j.id);
  // Relays raised outside a journey
  for (const r of await store.find('relays', { userId })) {
    await store.deleteWhere('relay_notifications', { relayId: r.id });
    await store.deleteWhere('relay_actions', { relayId: r.id });
    await store.delete('relays', r.id);
  }
  for (const c of await store.find('contacts', { userId })) await store.deleteWhere('push_subscriptions', { contactId: c.id });
  for (const t of ['contacts', 'events', 'grants', 'checkins', 'locations', 'observations', 'consent_log', 'relay_notifications', 'relay_actions'] as const) {
    await store.deleteWhere(t, { userId } as never);
  }
  await store.delete('users', userId);
  await deleteAuthUser(userId).catch(() => undefined);
}

export const presentContact = (c: Contact, pushDevices = 0) => ({
  id: c.id, name: c.name, relationship: c.relationship, tier: c.tier, status: c.status,
  phone: decryptField(c.phoneEnc), email: decryptField(c.emailEnc),
  consentedAt: c.consentedAt, tokenExpiresAt: c.tokenExpiresAt, seeded: c.seeded, createdAt: c.createdAt, pushDevices,
});

export async function exportAccount(userId: string) {
  const store = db();
  const user = await store.get('users', userId);
  const contacts = await store.find('contacts', { userId });
  const journeys = await store.find('journeys', { userId });
  const pick = async <T extends 'events' | 'locations' | 'checkins' | 'grants' | 'relays' | 'relay_notifications' | 'relay_actions' | 'observations' | 'consent_log'>(t: T) => store.find(t, { userId } as never);
  return {
    exportedAt: new Date().toISOString(),
    profile: user ? { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, consentVersion: user.consentVersion, settings: user.settings } : null,
    contacts: contacts.map((c) => presentContact(c)),
    journeys: journeys.map((j) => ({ ...j, route: { ...j.route, evidence: undefined } })),
    events: await pick('events'), locations: await pick('locations'), checkins: await pick('checkins'), accessGrants: await pick('grants'),
    helpRequests: await pick('relays'), notifications: await pick('relay_notifications'), contactReportedActions: await pick('relay_actions'),
    observationsYouReported: await pick('observations'), consentLog: await pick('consent_log'),
  };
}
