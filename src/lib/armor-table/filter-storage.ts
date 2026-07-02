// Auto-persist the armor table's filters + sort to localStorage so a refresh /
// reopen restores them (same best-effort pattern as builder/selection-storage.ts:
// no backend, malformed or stale data falls back to defaults, I/O never throws).
//
// Runtime imports are relative (not `@/`) — the vitest runner has no `@/` alias.
import { ARMOR_SLOTS, type ArmorSlot } from "../armory/stats";
import {
  DEFAULT_SORT,
  emptyFilters,
  isSortKey,
  type SortState,
  type TableFilters,
  type TuningFilter,
} from "./filters";

export const TABLE_STATE_KEY = "stat-builder:armor-table";
export const TABLE_SCHEMA_VERSION = 1;

export interface PersistedTableState {
  version: number;
  filters: TableFilters;
  sort: SortState;
}

function storage(): Storage | undefined {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage;
  } catch {
    // Reading `localStorage` itself can throw in sandboxed / privacy contexts.
    return undefined;
  }
}

const SLOT_SET = new Set<string>(ARMOR_SLOTS);

const numbers = (v: unknown): number[] =>
  Array.isArray(v) ? v.filter((n): n is number => typeof n === "number") : [];

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];

/** Parse + validate a stored string. Returns null on any malformed / stale / corrupt input. */
function parse(raw: string | null): PersistedTableState | null {
  if (!raw) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  if (o.version !== TABLE_SCHEMA_VERSION) return null;
  if (typeof o.filters !== "object" || o.filters === null) return null;
  const f = o.filters as Record<string, unknown>;

  const filters: TableFilters = {
    ...emptyFilters(),
    search: typeof f.search === "string" ? f.search : "",
    classes: numbers(f.classes),
    slots: strings(f.slots).filter((s): s is ArmorSlot => SLOT_SET.has(s)),
    setHashes: numbers(f.setHashes),
    archetypes: strings(f.archetypes),
    tunings: Array.isArray(f.tunings)
      ? f.tunings.filter(
          (t): t is TuningFilter => typeof t === "number" || t === "none",
        )
      : [],
    tertiaries: numbers(f.tertiaries),
  };

  const s = o.sort as Record<string, unknown> | null | undefined;
  const sort: SortState =
    s && isSortKey(s.key) && typeof s.asc === "boolean"
      ? { key: s.key, asc: s.asc }
      : DEFAULT_SORT;

  return { version: TABLE_SCHEMA_VERSION, filters, sort };
}

/** Read the stored table state, or null if absent / unreadable / stale / corrupt. */
export function loadTableState(): PersistedTableState | null {
  const s = storage();
  if (!s) return null;
  try {
    return parse(s.getItem(TABLE_STATE_KEY));
  } catch {
    return null;
  }
}

/** Persist the table state (best-effort — quota / security errors are swallowed). */
export function saveTableState(state: PersistedTableState): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(TABLE_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / security errors — persistence is best-effort.
  }
}
