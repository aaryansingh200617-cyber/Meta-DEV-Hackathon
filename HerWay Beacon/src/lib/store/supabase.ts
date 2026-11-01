import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { TableMap, TableName } from '../types';
import type { FindOptions, Store, Where } from './types';
import { env } from '../env';

const TABLE_NAME: Partial<Record<TableName, string>> = { users: 'profiles' };
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

const toDb = (o: object) => Object.fromEntries(Object.entries(o).map(([k, v]) => [snake(k), v]));
const fromDb = <T,>(o: Record<string, unknown>): T => Object.fromEntries(Object.entries(o).map(([k, v]) => [camel(k), v])) as T;

/**
 * Supabase / PostgreSQL driver (service-role, server-side only). Only top-level keys are
 * mapped camelCase <-> snake_case; nested objects live in jsonb columns unchanged.
 * Authorization is enforced in the API layer; RLS in the migration is defence-in-depth
 * for any direct client access.
 */
export class SupabaseStore implements Store {
  readonly kind = 'supabase' as const;
  private db: SupabaseClient;

  constructor() {
    this.db = createClient(env.supabaseUrl, env.supabaseService, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private t(table: TableName) { return TABLE_NAME[table] ?? table; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyWhere(q: any, where?: Record<string, unknown>): any {
    if (!where) return q;
    for (const [k, v] of Object.entries(where)) {
      if (v === undefined) continue;
      q = v === null ? q.is(snake(k), null) : q.eq(snake(k), v);
    }
    return q;
  }

  async get<K extends TableName>(table: K, id: string) {
    const { data, error } = await this.db.from(this.t(table)).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromDb<TableMap[K]>(data) : null;
  }

  async find<K extends TableName>(table: K, where?: Where<TableMap[K]>, opts: FindOptions = {}) {
    let q = this.applyWhere(this.db.from(this.t(table)).select('*'), where as Record<string, unknown>);
    if (opts.orderBy) q = q.order(snake(opts.orderBy), { ascending: !opts.desc });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map((r) => fromDb<TableMap[K]>(r));
  }

  async insert<K extends TableName>(table: K, row: TableMap[K]) {
    const { data, error } = await this.db.from(this.t(table)).insert(toDb(row)).select('*').single();
    if (error) throw new Error(error.message);
    return fromDb<TableMap[K]>(data);
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<TableMap[K]>) {
    const { data, error } = await this.db.from(this.t(table)).update(toDb(patch)).eq('id', id).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromDb<TableMap[K]>(data) : null;
  }

  async delete<K extends TableName>(table: K, id: string) {
    const { error } = await this.db.from(this.t(table)).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteWhere<K extends TableName>(table: K, where: Where<TableMap[K]>) {
    const q = this.applyWhere(this.db.from(this.t(table)).delete({ count: 'exact' }), where as Record<string, unknown>);
    const { error, count } = await q;
    if (error) throw new Error(error.message);
    return count ?? 0;
  }
}
