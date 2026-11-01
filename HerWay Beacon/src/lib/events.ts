import { db } from './store';
import { uid } from './crypto';
import type { EventType, JourneyEvent } from './types';

export async function addEvent(p: {
  userId: string; journeyId: string | null; type: EventType; actor?: JourneyEvent['actor']; message: string; data?: Record<string, unknown>; at?: string;
}): Promise<JourneyEvent> {
  const ev: JourneyEvent = {
    id: uid('ev_'), userId: p.userId, journeyId: p.journeyId, at: p.at ?? new Date().toISOString(),
    type: p.type, actor: p.actor ?? 'system', message: p.message, data: p.data,
  };
  await db().insert('events', ev);
  return ev;
}
