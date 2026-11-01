import { z } from 'zod';
import { body, forbidden, route } from '@/lib/http';
import { endSession, requireUser } from '@/lib/auth';
import { verifyPassword } from '@/lib/crypto';
import { deleteAccountData } from '@/lib/account';
import { useSupabase } from '@/lib/env';

const schema = z.object({ confirm: z.literal('DELETE'), password: z.string().optional() });

/** Permanent account deletion. Requires typing DELETE (and the password for non-demo local accounts). */
export const DELETE = route(async (req) => {
  const user = await requireUser();
  const b = await body(req, schema);
  if (!user.demo && !useSupabase() && !verifyPassword(b.password ?? '', user.passwordHash)) throw forbidden('Password is incorrect');
  await deleteAccountData(user.id);
  await endSession();
  return { ok: true };
});
