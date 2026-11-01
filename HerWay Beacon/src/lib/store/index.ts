import { useMongo, useSupabase } from '../env';
import type { Store } from './types';
import { FileStore } from './file';
import { SupabaseStore } from './supabase';
import { MongoStore } from './mongodb';

const g = globalThis as unknown as { __sjStore?: Store; __sjTickerStarted?: boolean };

/** Singleton per server process (survives Next.js dev module reloads). */
export function db(): Store {
  if (!g.__sjStore) {
    if (useSupabase()) {
      g.__sjStore = new SupabaseStore();
    } else if (useMongo()) {
      g.__sjStore = new MongoStore();
    } else {
      g.__sjStore = new FileStore(process.env.SJ_STORE === 'memory');
    }
  }
  if (!g.__sjTickerStarted && typeof window === 'undefined') {
    g.__sjTickerStarted = true;
    import('../engine').then(({ startTicker }) => startTicker(5000)).catch(() => {});
  }
  return g.__sjStore;
}

export type { Store } from './types';
