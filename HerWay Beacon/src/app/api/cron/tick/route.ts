import { NextRequest } from 'next/server';
import { route, unauthorized } from '@/lib/http';
import { tick } from '@/lib/engine';
import { env } from '@/lib/env';

async function run(req: NextRequest) {
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-cron-secret');
  if (env.cronSecret ? given !== env.cronSecret : process.env.NODE_ENV === 'production') throw unauthorized('Invalid cron secret');
  return tick();
}
export const GET = route(run);
export const POST = route(run);
