import { body, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { settingsSchema } from '@/lib/schemas';

export const GET = route(async () => ({ settings: (await requireUser()).settings }));

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const patch = await body(req, settingsSchema);
  const settings = { ...user.settings, ...patch };
  await db().update('users', user.id, { settings });
  return { settings };
});
