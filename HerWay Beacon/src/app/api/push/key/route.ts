import { route } from '@/lib/http';
import { env } from '@/lib/env';

export const GET = route(async () => ({ publicKey: env.vapidPublic || null }));
