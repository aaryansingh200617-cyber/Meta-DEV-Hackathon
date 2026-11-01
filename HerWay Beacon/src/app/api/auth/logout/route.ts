import { route } from '@/lib/http';
import { endSession } from '@/lib/auth';

export const POST = route(async () => { await endSession(); return { ok: true }; });
