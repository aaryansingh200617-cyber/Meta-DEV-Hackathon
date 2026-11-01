import { z } from 'zod';
import { body, clientIp, rateLimit, route } from '@/lib/http';
import { loginWithGoogle, publicUser, startSession } from '@/lib/auth';

const schema = z.object({
  credential: z.string().min(10, 'Google credential token is required'),
});

export const POST = route(async (req) => {
  rateLimit(`google-auth:${clientIp(req)}`, 15, 5 * 60_000);
  const b = await body(req, schema);
  const user = await loginWithGoogle(b.credential);
  await startSession(user);
  return { user: publicUser(user) };
});
