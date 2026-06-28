import type { db } from '../../db';

export type AdminDb = typeof db;
export type RelatedLoader = (id: string) => Promise<Record<string, unknown>>;
