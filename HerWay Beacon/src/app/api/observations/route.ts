import { z } from 'zod';
import { body, rateLimit, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { uid } from '@/lib/crypto';

const schema = z.object({
  kind: z.enum(['lighting', 'visibility', 'activity']),
  value: z.enum(['good', 'moderate', 'poor']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  note: z.string().trim().max(140).optional(),
});

/** Community observation: a dated, attributable-to-you-only report that feeds route evidence for everyone. */
export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`obs:${user.id}`, 30, 60 * 60_000);
  const b = await body(req, schema);
  const row = { id: uid('o_'), userId: user.id, kind: b.kind, value: b.value, lat: b.lat, lng: b.lng, note: b.note, observedAt: new Date().toISOString(), source: 'community' as const };
  await db().insert('observations', row);
  const { userId: _u, ...pub } = row;
  return { observation: pub };
});
