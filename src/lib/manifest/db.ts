import { openDB, type IDBPDatabase } from "idb";
import type { ManifestTableName } from "./tables";

/**
 * IndexedDB cache for the Destiny manifest. Each definition table is stored
 * under its own key in the `tables` store; the cached manifest `version` lives
 * in the `meta` store so we can detect a stale cache and re-download.
 */

const DB_NAME = "stat-builder-manifest";
const DB_VERSION = 1;
const TABLES_STORE = "tables";
const META_STORE = "meta";
const VERSION_KEY = "version";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore(TABLES_STORE);
        db.createObjectStore(META_STORE);
      },
    });
  }
  return dbPromise;
}

export async function getCachedVersion(): Promise<string | undefined> {
  return (await getDb()).get(META_STORE, VERSION_KEY);
}

export async function setCachedVersion(version: string): Promise<void> {
  await (await getDb()).put(META_STORE, version, VERSION_KEY);
}

export async function getCachedTable<T>(
  table: ManifestTableName,
): Promise<Record<number, T> | undefined> {
  return (await getDb()).get(TABLES_STORE, table);
}

export async function setCachedTable<T>(
  table: ManifestTableName,
  data: Record<number, T>,
): Promise<void> {
  await (await getDb()).put(TABLES_STORE, data, table);
}

export async function clearCache(): Promise<void> {
  const db = await getDb();
  await db.clear(TABLES_STORE);
  await db.clear(META_STORE);
}
