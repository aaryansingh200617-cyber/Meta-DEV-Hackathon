import { z } from 'zod';
import { body, clientIp, rateLimit, route } from '@/lib/http';
import { loginUser, publicUser, startSession } from '@/lib/auth';

const schema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(200) });

export const POST = route(async (req) => {
  rateLimit(`login:${clientIp(req)}`, 10, 5 * 60_000);
  const b = await body(req, schema);
  const { user, tokens } = await loginUser(b.email, b.password);
  await startSession(user, tokens);
  return { user: publicUser(user) };
});
