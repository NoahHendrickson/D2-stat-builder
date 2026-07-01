import {
  getDestinyManifest,
  type DestinyInventoryItemDefinition,
} from "bungie-api-ts/destiny2";
import { createBungieHttp } from "@/lib/bungie/http";
import {
  MANIFEST_TABLES,
  type ManifestTableName,
  type ManifestTables,
} from "./tables";
import {
  clearCache,
  getCachedTable,
  getCachedVersion,
  setCachedTable,
  setCachedVersion,
} from "./db";

const BUNGIE_ROOT = "https://www.bungie.net";

// DestinyItemType values we keep from the (huge) item table.
const ITEM_TYPE_ARMOR = 2;
const ITEM_TYPE_MOD = 19;

export interface Manifest {
  version: string;
  tables: ManifestTables;
  /** Look up a single definition by hash. */
  def<T extends ManifestTableName>(
    table: T,
    hash: number | undefined | null,
  ): ManifestTables[T][number] | undefined;
  /** The whole table. */
  all<T extends ManifestTableName>(table: T): ManifestTables[T];
  /** Entry counts per table (for diagnostics). */
  counts(): Record<ManifestTableName, number>;
}

function makeManifest(version: string, tables: ManifestTables): Manifest {
  return {
    version,
    tables,
    def(table, hash) {
      if (hash == null) return undefined;
      return tables[table][hash];
    },
    all(table) {
      return tables[table];
    },
    counts() {
      const out = {} as Record<ManifestTableName, number>;
      for (const t of MANIFEST_TABLES) out[t] = Object.keys(tables[t]).length;
      return out;
    },
  };
}

/** Keep only armor pieces + plugs/mods from the full item table (it's ~190MB otherwise). */
function filterInventoryItems(
  all: Record<number, DestinyInventoryItemDefinition>,
): Record<number, DestinyInventoryItemDefinition> {
  const out: Record<number, DestinyInventoryItemDefinition> = {};
  for (const key in all) {
    const def = all[key];
    if (
      def.itemType === ITEM_TYPE_ARMOR ||
      def.itemType === ITEM_TYPE_MOD ||
      def.plug
    ) {
      out[key as unknown as number] = def;
    }
  }
  return out;
}

async function downloadTable(path: string): Promise<Record<number, unknown>> {
  const res = await fetch(`${BUNGIE_ROOT}${path}`);
  if (!res.ok) throw new Error(`Failed to download ${path}: ${res.status}`);
  return res.json();
}

/**
 * Ensure the manifest is available locally and return typed accessors.
 * Uses the IndexedDB cache when the version matches; otherwise re-downloads
 * the needed tables (filtering the item table down to armor + plugs).
 */
export async function loadManifest(
  onProgress?: (message: string) => void,
): Promise<Manifest> {
  const http = createBungieHttp();
  onProgress?.("Checking manifest version…");
  const res = await getDestinyManifest(http);
  const info = res.Response;
  const version = info.version;
  const paths = info.jsonWorldComponentContentPaths.en;

  // Cache hit: load every needed table from IndexedDB.
  if ((await getCachedVersion()) === version) {
    const tables = {} as ManifestTables;
    let complete = true;
    for (const table of MANIFEST_TABLES) {
      const data = await getCachedTable(table);
      if (!data) {
        complete = false;
        break;
      }
      tables[table] = data as never;
    }
    if (complete) {
      onProgress?.("Loaded manifest from cache");
      return makeManifest(version, tables);
    }
  }

  // Stale or incomplete: re-download.
  await clearCache();
  const tables = {} as ManifestTables;
  for (const table of MANIFEST_TABLES) {
    onProgress?.(`Downloading ${table.replace("Destiny", "").replace("Definition", "")}…`);
    const raw = await downloadTable(paths[table]);
    const data =
      table === "DestinyInventoryItemDefinition"
        ? filterInventoryItems(
            raw as Record<number, DestinyInventoryItemDefinition>,
          )
        : raw;
    tables[table] = data as never;
    await setCachedTable(table, data as Record<number, unknown>);
  }
  await setCachedVersion(version);
  onProgress?.("Manifest ready");
  return makeManifest(version, tables);
}
