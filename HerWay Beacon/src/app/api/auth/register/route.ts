import { z } from 'zod';
import { body, clientIp, rateLimit, route } from '@/lib/http';
import { loginUser, publicUser, registerUser, startSession } from '@/lib/auth';

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
  consent: z.literal(true, { errorMap: () => ({ message: 'You must accept the privacy notice to create an account' }) }),
});

export const POST = route(async (req) => {
  rateLimit(`reg:${clientIp(req)}`, 8, 10 * 60_000);
  const b = await body(req, schema);
  await registerUser(b);
  const { user, tokens } = await loginUser(b.email, b.password);
  await startSession(user, tokens);
  return { user: publicUser(user) };
});
