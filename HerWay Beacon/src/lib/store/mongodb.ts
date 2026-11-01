import { MongoClient, type Db } from 'mongodb';
import type { TableMap, TableName } from '../types';
import type { FindOptions, Store, Where } from './types';
import { env } from '../env';
import { FileStore } from './file';

const g = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoIndexesEnsured?: boolean;
  _mongoFailed?: boolean;
};

function getClientPromise(): Promise<MongoClient> {
  if (!g._mongoClientPromise) {
    if (!env.mongoUri) {
      throw new Error('MONGODB_URI is not set in environment variables');
    }
    const client = new MongoClient(env.mongoUri, {
      connectTimeoutMS: 3000,
      serverSelectionTimeoutMS: 3000,
    });
    g._mongoClientPromise = client.connect().catch((err) => {
      g._mongoFailed = true;
      console.warn('[store] MongoDB connection timed out or unreachable, using local file store:', err.message);
      throw err;
    });
  }
  return g._mongoClientPromise;
}

export async function getMongoDb(): Promise<Db> {
  if (g._mongoFailed) {
    throw new Error('MongoDB marked as failed');
  }
  const client = await getClientPromise();
  const db = client.db(env.mongoDb);
  if (!g._mongoIndexesEnsured) {
    g._mongoIndexesEnsured = true;
    // Asynchronously create useful indexes in background
    Promise.all([
      db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true }).catch(() => {}),
      db.collection('contacts').createIndex({ userId: 1 }).catch(() => {}),
      db.collection('journeys').createIndex({ userId: 1 }).catch(() => {}),
      db.collection('events').createIndex({ journeyId: 1 }).catch(() => {}),
      db.collection('locations').createIndex({ journeyId: 1 }).catch(() => {}),
      db.collection('grants').createIndex({ journeyId: 1 }).catch(() => {}),
    ]).catch(() => {});
  }
  return db;
}

function cleanDoc<T>(doc: unknown): T | null {
  if (!doc || typeof doc !== 'object') return null;
  const { _id, ...rest } = doc as { _id?: unknown; [key: string]: unknown };
  return { id: String(_id), ...rest } as T;
}

function toMongoWhere<T extends Record<string, unknown>>(where?: Where<T>): Record<string, unknown> {
  if (!where) return {};
  const query: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;
    if (k === 'id') {
      query._id = v;
    } else {
      query[k] = v;
    }
  }
  return query;
}

/**
 * MongoDB Atlas / local MongoDB driver implementing the unified Store interface.
 * Connects via standard MongoClient singleton (safe for Next.js hot reload & serverless).
 */
export class MongoStore implements Store {
  readonly kind = 'mongodb' as const;
  private readonly fileFallback = new FileStore();

  private async col<K extends TableName>(table: K) {
    const db = await getMongoDb();
    return db.collection(table);
  }

  async get<K extends TableName>(table: K, id: string): Promise<TableMap[K] | null> {
    if (g._mongoFailed) return this.fileFallback.get(table, id);
    try {
      const col = await this.col(table);
      const doc = await col.findOne({ $or: [{ _id: id as never }, { id }] });
      return doc ? cleanDoc<TableMap[K]>(doc) : null;
    } catch {
      g._mongoFailed = true;
      return this.fileFallback.get(table, id);
    }
  }

  async find<K extends TableName>(table: K, where?: Where<TableMap[K]>, opts: FindOptions = {}): Promise<TableMap[K][]> {
    if (g._mongoFailed) return this.fileFallback.find(table, where, opts);
    try {
      const col = await this.col(table);
      const q = toMongoWhere(where as Record<string, unknown>);
      let cursor = col.find(q);

      if (opts.orderBy) {
        const orderKey = opts.orderBy === 'id' ? '_id' : opts.orderBy;
        cursor = cursor.sort({ [orderKey]: opts.desc ? -1 : 1 });
      }
      if (opts.limit) {
        cursor = cursor.limit(opts.limit);
      }

      const docs = await cursor.toArray();
      return docs.map((d) => cleanDoc<TableMap[K]>(d)!).filter(Boolean);
    } catch {
      g._mongoFailed = true;
      return this.fileFallback.find(table, where, opts);
    }
  }

  async insert<K extends TableName>(table: K, row: TableMap[K]): Promise<TableMap[K]> {
    if (g._mongoFailed) return this.fileFallback.insert(table, row);
    try {
      const col = await this.col(table);
      const id = (row as { id: string }).id;
      const doc = { _id: id as never, ...row };
      await col.replaceOne({ _id: id as never }, doc as never, { upsert: true });
      return row;
    } catch {
      g._mongoFailed = true;
      return this.fileFallback.insert(table, row);
    }
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<TableMap[K]>): Promise<TableMap[K] | null> {
    if (g._mongoFailed) return this.fileFallback.update(table, id, patch);
    try {
      const col = await this.col(table);
      const { id: _ignoreId, ...rest } = patch as { id?: string; [k: string]: unknown };
      await col.updateOne(
        { $or: [{ _id: id as never }, { id }] } as never,
        { $set: rest as never }
      );
      return this.get(table, id);
    } catch {
      g._mongoFailed = true;
      return this.fileFallback.update(table, id, patch);
    }
  }

  async delete<K extends TableName>(table: K, id: string): Promise<void> {
    if (g._mongoFailed) return this.fileFallback.delete(table, id);
    try {
      const col = await this.col(table);
      await col.deleteOne({ $or: [{ _id: id as never }, { id }] } as never);
    } catch {
      g._mongoFailed = true;
      return this.fileFallback.delete(table, id);
    }
  }

  async deleteWhere<K extends TableName>(table: K, where: Where<TableMap[K]>): Promise<number> {
    if (g._mongoFailed) return this.fileFallback.deleteWhere(table, where);
    try {
      const col = await this.col(table);
      const q = toMongoWhere(where as Record<string, unknown>);
      const res = await col.deleteMany(q as never);
      return res.deletedCount || 0;
    } catch {
      g._mongoFailed = true;
      return this.fileFallback.deleteWhere(table, where);
    }
  }
}
