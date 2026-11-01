import { route } from '@/lib/http';
import { integrationStatus } from '@/lib/env';

export const GET = route(async () => integrationStatus());
