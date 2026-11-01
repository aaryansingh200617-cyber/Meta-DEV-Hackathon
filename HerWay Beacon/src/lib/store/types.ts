import type { TableMap, TableName } from '../types';

export interface FindOptions { orderBy?: string; desc?: boolean; limit?: number }
export type Where<T> = Partial<{ [K in keyof T]: T[K] | null }>;

/** Minimal table API implemented by both the local file store and Supabase (PostgREST). */
export interface Store {
  readonly kind: 'file' | 'supabase' | 'mongodb';
  get<K extends TableName>(table: K, id: string): Promise<TableMap[K] | null>;
  find<K extends TableName>(table: K, where?: Where<TableMap[K]>, opts?: FindOptions): Promise<TableMap[K][]>;
  insert<K extends TableName>(table: K, row: TableMap[K]): Promise<TableMap[K]>;
  update<K extends TableName>(table: K, id: string, patch: Partial<TableMap[K]>): Promise<TableMap[K] | null>;
  delete<K extends TableName>(table: K, id: string): Promise<void>;
  deleteWhere<K extends TableName>(table: K, where: Where<TableMap[K]>): Promise<number>;
}
