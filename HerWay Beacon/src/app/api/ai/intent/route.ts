import { z } from 'zod';
import { body, rateLimit, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { parseIntent } from '@/lib/ai/assistant';

const schema = z.object({ text: z.string().trim().min(1).max(600) });

export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`intent:${user.id}`, 30, 60_000);
  const { text } = await body(req, schema);
  const contacts = await db().find('contacts', { userId: user.id });
  return parseIntent(text, contacts, user.settings.aiEnabled);
});
