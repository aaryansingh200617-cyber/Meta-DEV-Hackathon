import webpush from 'web-push';
import { db } from './store';
import { env } from './env';
import { uid } from './crypto';
import { makeContactToken } from './contact-token';
import { decryptField } from './crypto';
import type { Contact, Relay, RelayNotification, User } from './types';
import { nowIso } from './utils';

let vapidReady = false;
export function pushConfigured() {
  if (!env.vapidPublic || !env.vapidPrivate) return false;
  if (!vapidReady) { webpush.setVapidDetails(env.vapidSubject, env.vapidPublic, env.vapidPrivate); vapidReady = true; }
  return true;
}

const TITLES: Record<Relay['kind'], string> = {
  call_me: 'asked you to call her',
  urgent: 'needs urgent help',
  auto_missed_checkin: 'missed her safety check-ins',
  auto_overdue: 'has not arrived on time',
  auto_deviation: 'left her planned route',
};
export const relayHeadline = (kind: Relay['kind'], name: string) => `${name} ${TITLES[kind]}`;

/**
 * Sends one relay step to one contact across every channel and records what REALLY happened:
 *  - in_app    : stored for the contact dashboard; becomes "delivered" only when that dashboard fetches it
 *  - web_push  : "sent" when the push service accepts it; "delivered" when the contact's device confirms receipt
 *  - sms_sim   : SIMULATED. No SMS/voice provider is wired up, so nothing leaves the server.
 */
export async function dispatchToContact(relay: Relay, contact: Contact, traveller: User, step: number): Promise<RelayNotification[]> {
  const t = nowIso();
  const mk = (channel: RelayNotification['channel'], status: RelayNotification['status'], detail: string | null): RelayNotification => ({
    id: uid('n_'), relayId: relay.id, userId: relay.userId, contactId: contact.id, step, channel, status, detail,
    sentAt: status === 'sent' || status === 'simulated' ? t : null, deliveredAt: null, acknowledgedAt: null,
  });
  const out: RelayNotification[] = [];

  out.push(mk('in_app', 'sent', 'Waiting on the contact dashboard'));

  const subs = await db().find('push_subscriptions', { contactId: contact.id });
  if (!pushConfigured()) out.push(mk('web_push', 'skipped', 'Web Push is not configured on this server'));
  else if (!subs.length) out.push(mk('web_push', 'skipped', 'Contact has not enabled notifications on any device'));
  else {
    const n = mk('web_push', 'queued', null);
    let ok = 0; let lastErr = '';
    const token = makeContactToken(contact);
    const payload = JSON.stringify({
      title: 'HerWay Beacon',
      body: relayHeadline(relay.kind, traveller.name.split(' ')[0] ?? traveller.name),
      url: `/c/${token}`,
      receipt: `/api/contact/${token}/receipt`,
      notificationId: n.id,
      tag: relay.id,
    });
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: 'high' });
        ok++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        lastErr = `push service said ${code ?? 'error'}`;
        if (code === 404 || code === 410) await db().delete('push_subscriptions', s.id);
      }
    }
    n.status = ok ? 'sent' : 'failed';
    n.sentAt = ok ? nowIso() : null;
    n.detail = ok ? `Accepted by push service for ${ok} device${ok === 1 ? '' : 's'}` : lastErr || 'Push failed';
    out.push(n);
  }

  if (decryptField(contact.phoneEnc)) out.push(mk('sms_sim', 'simulated', 'SIMULATED — no SMS/voice provider is configured, nothing was sent'));
  else out.push(mk('sms_sim', 'skipped', 'No phone number on file'));

  for (const n of out) await db().insert('relay_notifications', n);
  return out;
}
