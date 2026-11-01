import fs from 'node:fs';
import path from 'node:path';
import type { TableMap, TableName } from '../types';
import type { FindOptions, Store, Where } from './types';
import { env } from '../env';

const TABLES: TableName[] = ['users', 'contacts', 'push_subscriptions', 'journeys', 'locations', 'checkins', 'grants', 'events', 'relays', 'relay_notifications', 'relay_actions', 'observations', 'consent_log'];

type Data = { [K in TableName]: TableMap[K][] };

const clone = <T,>(v: T): T => structuredClone(v);

/**
 * Single-process JSON store: in-memory with debounced atomic writes (tmp file + rename).
 * Good for the demo and local development; use the Supabase driver for anything multi-instance.
 */
export class FileStore implements Store {
  readonly kind = 'file' as const;
  private data: Data;
  private file: string | null;
  private timer: NodeJS.Timeout | null = null;

  constructor(memoryOnly = false) {
    this.data = Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Data;
    this.file = null;
    if (!memoryOnly) {
      const dir = path.resolve(process.cwd(), env.dataDir);
      this.file = path.join(dir, 'db.json');
      try {
        fs.mkdirSync(dir, { recursive: true });
        if (fs.existsSync(this.file)) {
          const loaded = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Partial<Data>;
          for (const t of TABLES) if (Array.isArray(loaded[t])) (this.data as Record<string, unknown[]>)[t] = loaded[t] as unknown[];
        }
      } catch (e) {
        console.error('[herway] could not read data file, starting empty:', e);
      }
      process.once('beforeExit', () => this.flushSync());
    }
  }

  private schedule() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flushSync(); }, 150);
    this.timer.unref?.();
  }

  flushSync() {
    if (!this.file) return;
    try {
      const tmp = `${this.file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      console.error('[herway] flush failed', e);
    }
  }

  private rows<K extends TableName>(t: K): TableMap[K][] { return this.data[t] as TableMap[K][]; }

  private match<K extends TableName>(row: TableMap[K], where?: Where<TableMap[K]>) {
    if (!where) return true;
    for (const [k, v] of Object.entries(where)) {
      const rv = (row as unknown as Record<string, unknown>)[k];
      if (v === null) { if (rv !== null && rv !== undefined) return false; }
      else if (v !== undefined && rv !== v) return false;
    }
    return true;
  }

  async get<K extends TableName>(table: K, id: string) {
    const r = this.rows(table).find((x) => (x as { id: string }).id === id);
    return r ? clone(r) : null;
  }

  async find<K extends TableName>(table: K, where?: Where<TableMap[K]>, opts: FindOptions = {}) {
    let out = this.rows(table).filter((r) => this.match(r, where));
    if (opts.orderBy) {
      const key = opts.orderBy;
      out = [...out].sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[key] as string | number;
        const bv = (b as unknown as Record<string, unknown>)[key] as string | number;
        return (av < bv ? -1 : av > bv ? 1 : 0) * (opts.desc ? -1 : 1);
      });
    }
    if (opts.limit) out = out.slice(0, opts.limit);
    return out.map(clone);
  }

  async insert<K extends TableName>(table: K, row: TableMap[K]) {
    this.rows(table).push(clone(row));
    this.schedule();
    return clone(row);
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<TableMap[K]>) {
    const r = this.rows(table).find((x) => (x as { id: string }).id === id);
    if (!r) return null;
    Object.assign(r as object, clone(patch));
    this.schedule();
    return clone(r);
  }

  async delete<K extends TableName>(table: K, id: string) {
    const arr = this.rows(table);
    const i = arr.findIndex((x) => (x as { id: string }).id === id);
    if (i >= 0) arr.splice(i, 1);
    this.schedule();
  }

  async deleteWhere<K extends TableName>(table: K, where: Where<TableMap[K]>) {
    const arr = this.rows(table);
    const keep = arr.filter((r) => !this.match(r, where));
    const n = arr.length - keep.length;
    (this.data as Record<string, unknown[]>)[table] = keep;
    if (n) this.schedule();
    return n;
  }
}
