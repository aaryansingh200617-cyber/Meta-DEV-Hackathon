import { z } from 'zod';
import { body, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { compareRoutes } from '@/lib/routing';
import { modeSchema, placeSchema } from '@/lib/schemas';
import { DISCLAIMER } from '@/lib/defaults';

const schema = z.object({ origin: placeSchema, destination: placeSchema, mode: modeSchema.default('walk') });

export const POST = route(async (req) => {
  await requireUser();
  const b = await body(req, schema);
  const res = await compareRoutes(b.origin, b.destination, b.mode);
  return { ...res, disclaimer: DISCLAIMER, generatedAt: new Date().toISOString() };
});
