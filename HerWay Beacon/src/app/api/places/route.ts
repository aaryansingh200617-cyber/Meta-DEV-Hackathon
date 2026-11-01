import { route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { searchPlaces } from '@/lib/routing';

export const GET = route(async (req) => {
  await requireUser();
  const q = req.nextUrl.searchParams.get('q') ?? '';
  return searchPlaces(q.slice(0, 120));
});
