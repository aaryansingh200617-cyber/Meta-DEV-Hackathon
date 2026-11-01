import { route } from '@/lib/http';
import { currentUser, publicUser } from '@/lib/auth';

export const GET = route(async () => {
  const u = await currentUser();
  return { user: u ? publicUser(u) : null };
});
