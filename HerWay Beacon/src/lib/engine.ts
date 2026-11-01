/**
 * Backend timer + escalation engine.
 *
 * Design: every deadline (ETA, check-in window, deviation prompt, relay escalation, grant expiry,
 * retention) is a timestamp stored on a row. `tick()` evaluates them against the clock and is
 * IDEMPOTENT — each transition is guarded by persisted state, so it is safe to run from:
 *   • a self-scheduling interval on long-running Node servers (instrumentation.ts)
 *   • an external cron hitting /api/cron/tick (serverless)
 *   • lazily, on every traveller/contact poll
 * Deadlines therefore keep firing even if the traveller's phone is off or the browser is closed.
 */
import { db } from './store';
import { uid } from './crypto';
import { addEvent } from './events';
import { endJourney } from './journeys';
import { createRelay, escalateIfDue } from './relay';
import { isActive } from './grants';
import { MAX_OVERRUN_HOURS } from './defaults';
import type { Journey, User } from './types';
import { addSeconds, nowIso } from './utils';

const g = globalThis as unknown as { __sjTick?: { running: boolean; last: number; lastPurge: number; timer?: NodeJS.Timeout } };
const state = (g.__sjTick ??= { running: false, last: 0, lastPurge: 0 });

export interface TickReport { at: string; journeys: number; relays: number; revoked: number; purged: number; skipped?: boolean }

export async function tick(now = Date.now()): Promise<TickReport> {
  if (state.running) return { at: nowIso(), journeys: 0, relays: 0, revoked: 0, purged: 0, skipped: true };
  state.running = true;
  state.last = Date.now();
  const report: TickReport = { at: new Date(now).toISOString(), journeys: 0, relays: 0, revoked: 0, purged: 0 };
  try {
    // 1. Expire grants
    for (const gr of await db().find('grants', { revokedAt: null })) {
      if (!isActive(gr, now)) {
        await db().update('grants', gr.id, { revokedAt: new Date(now).toISOString(), revokedReason: 'expired' });
        report.revoked++;
      }
    }

    // 2. Active journeys
    const journeys = await db().find('journeys', { status: 'active' });
    for (const j of journeys) {
      const user = await db().get('users', j.userId);
      if (!user) continue;
      try { await tickJourney(j, user, now); report.journeys++; } catch (e) { console.error('[engine] journey', j.id, e); }
    }

    // 3. Relay escalation (continues even after a journey ends)
    for (const r of await db().find('relays', { status: 'open' })) {
      try { await escalateIfDue(r, now); report.relays++; } catch (e) { console.error('[engine] relay', r.id, e); }
    }

    // 4. Retention purge (at most once a minute)
    if (now - state.lastPurge > 60_000) {
      state.lastPurge = now;
      report.purged = await purgeExpired(now);
    }
  } finally {
    state.running = false;
  }
  return report;
}

async function tickJourney(j0: Journey, user: User, now: number) {
  let j = j0;
  const eta = new Date(j.expectedArrivalAt).getTime();

  // Hard cap
  if (now >= eta + j.graceMinutes * 60_000 + MAX_OVERRUN_HOURS * 3600_000) {
    await endJourney(j, user, 'expired');
    return;
  }

  // Overdue
  if (!j.overdueAt && now >= eta + j.graceMinutes * 60_000) {
    const at = new Date(now).toISOString();
    await db().update('journeys', j.id, { overdueAt: at });
    await addEvent({ userId: j.userId, journeyId: j.id, type: 'overdue', message: `No arrival confirmed ${j.graceMinutes} min after the expected time.${j.autoAlertOnOverdue ? ' Alerting your trusted contacts, as you chose.' : ' Automatic alerts are off, so contacts were not notified — extend your ETA or end the journey.'}` });
    if (j.autoAlertOnOverdue) {
      j = (await db().get('journeys', j.id))!;
      await createRelay({ user, kind: 'auto_overdue', journey: j, message: 'Has not arrived by the expected time.', includeLocation: j.escalationShareLocation, actor: 'system' });
    }
  }

  // Check-ins
  if (j.checkinIntervalS > 0) {
    const pending = (await db().find('checkins', { journeyId: j.id, status: 'pending' }))[0];
    if (pending) {
      if (now >= new Date(pending.windowEndsAt).getTime()) {
        await db().update('checkins', pending.id, { status: 'missed' });
        const streak = j.missedStreak + 1;
        await db().update('journeys', j.id, { missedStreak: streak, nextCheckinDueAt: addSeconds(now, j.checkinIntervalS) });
        await addEvent({ userId: j.userId, journeyId: j.id, type: 'checkin_missed', message: `Check-in missed (${streak} in a row).` });
        if (streak === j.maxMissed) {
          if (j.autoAlertOnMissed) {
            await addEvent({ userId: j.userId, journeyId: j.id, type: 'missed_threshold', message: `${streak} missed check-ins — alerting your trusted contacts, as you chose.` });
            if (!(await hasOpenRelay(j.id))) await createRelay({ user, kind: 'auto_missed_checkin', journey: j, message: 'Missed consecutive safety check-ins.', includeLocation: j.escalationShareLocation, actor: 'system' });
          } else {
            await addEvent({ userId: j.userId, journeyId: j.id, type: 'missed_threshold', message: `${streak} missed check-ins. Automatic alerts are off, so contacts were not notified.` });
          }
        }
      }
    } else if (j.nextCheckinDueAt && now >= new Date(j.nextCheckinDueAt).getTime()) {
      const due = new Date(now).toISOString();
      await db().insert('checkins', { id: uid('c_'), journeyId: j.id, userId: j.userId, dueAt: due, windowEndsAt: addSeconds(now, j.checkinWindowS), status: 'pending', respondedAt: null });
      await addEvent({ userId: j.userId, journeyId: j.id, type: 'checkin_prompted', message: `Check-in requested — ${j.checkinWindowS >= 60 ? Math.round(j.checkinWindowS / 60) + ' min' : j.checkinWindowS + ' s'} to respond.` });
    }
  }

  // Unanswered deviation prompt
  if (j.deviationState === 'prompting' && j.deviationPromptExpiresAt && now >= new Date(j.deviationPromptExpiresAt).getTime()) {
    if (j.autoAlertOnDeviation) {
      await db().update('journeys', j.id, { deviationState: 'alerted', deviationPromptExpiresAt: null });
      await addEvent({ userId: j.userId, journeyId: j.id, type: 'deviation_unanswered', message: 'You did not respond to the route-deviation prompt — alerting your trusted contacts, as you chose.' });
      if (!(await hasOpenRelay(j.id))) await createRelay({ user, kind: 'auto_deviation', journey: j, message: 'Left the planned route and did not respond.', includeLocation: j.escalationShareLocation, actor: 'system' });
    } else {
      await db().update('journeys', j.id, { deviationState: 'unanswered', deviationPromptExpiresAt: null });
      await addEvent({ userId: j.userId, journeyId: j.id, type: 'deviation_unanswered', message: 'No response to the route-deviation prompt. Automatic alerts are off, so contacts were not notified.' });
    }
  }
}

async function hasOpenRelay(journeyId: string) {
  return (await db().find('relays', { journeyId })).some((r) => r.status === 'open' || r.status === 'acknowledged');
}

/** Delete finished journeys (and every row hanging off them) once their retention period has passed. */
async function purgeExpired(now: number): Promise<number> {
  let n = 0;
  const finished = (await db().find('journeys')).filter((j) => j.status !== 'active' && j.purgeAfter && new Date(j.purgeAfter).getTime() <= now);
  for (const j of finished) { await deleteJourneyData(j.id); n++; }
  return n;
}

export async function deleteJourneyData(journeyId: string) {
  const relays = await db().find('relays', { journeyId });
  for (const r of relays) {
    await db().deleteWhere('relay_notifications', { relayId: r.id });
    await db().deleteWhere('relay_actions', { relayId: r.id });
  }
  await db().deleteWhere('relays', { journeyId });
  for (const t of ['locations', 'checkins', 'grants', 'events'] as const) await db().deleteWhere(t, { journeyId });
  await db().delete('journeys', journeyId);
}

/** Cheap guard used by API reads so state is fresh even without a background timer. */
export async function maybeTick(minGapMs = 12000) {
  if (Date.now() - state.last >= minGapMs) await tick();
}

/** Start the self-scheduling loop (long-running Node server). Safe to call more than once. */
export function startTicker(everyMs: number) {
  if (state.timer) return;
  state.timer = setInterval(() => { tick().catch((e) => console.error('[engine] tick failed', e)); }, everyMs);
  state.timer.unref?.();
  console.log(`[herway] engine ticking every ${everyMs} ms`);
}
