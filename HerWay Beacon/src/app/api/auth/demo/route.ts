import crypto from 'node:crypto';
import { clientIp, rateLimit, route } from '@/lib/http';
import { loginUser, publicUser, registerUser, startSession } from '@/lib/auth';
import { seedDemoData } from '@/lib/seed';
import { useSupabase } from '@/lib/env';

/** Creates a throw-away, pre-populated sandbox account (sample contacts + history, all clearly labelled sample data). */
export const POST = route(async (req) => {
  rateLimit(`demo:${clientIp(req)}`, 10, 10 * 60_000);
  if (useSupabase() && process.env.ALLOW_DEMO_ACCOUNTS !== '1') {
    return Response.json({ error: { code: 'demo_disabled', message: 'Demo accounts are disabled when Supabase Auth is in use. Set ALLOW_DEMO_ACCOUNTS=1 to enable.' } }, { status: 403 });
  }
  const password = crypto.randomBytes(12).toString('base64url');
  const email = `demo-${crypto.randomBytes(4).toString('hex')}@herway.demo`;
  const user = await registerUser({ email, password, name: 'Demo Traveller', demo: true });
  await seedDemoData(user);
  const { tokens } = await loginUser(email, password);
  await startSession(user, tokens);
  return { user: publicUser(user) };
});
