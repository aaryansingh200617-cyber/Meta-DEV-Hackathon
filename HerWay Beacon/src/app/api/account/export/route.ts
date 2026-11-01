import { route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { exportAccount } from '@/lib/account';

export const GET = route(async () => {
  const user = await requireUser();
  const data = await exportAccount(user.id);
  return new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="herway-beacon-export.json"' } });
});
