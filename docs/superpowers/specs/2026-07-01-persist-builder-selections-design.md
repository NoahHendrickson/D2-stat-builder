# Persist builder selections across refresh — design

**Date:** 2026-07-01 · **Status:** implemented — module TDD-tested (10 tests), wiring type-checks + serves 200; pending Noah's in-browser restore-after-refresh check

## Goal

Auto-remember the builder's current selections and restore them on refresh / reopen —
no save button, no naming. You leave the page mid-build, come back, and it's exactly as
you left it (and, thanks to the existing auto-search, the optimizer just re-runs). Local
to the browser; no backend, no cross-device sync (that's the deferred "named builds"
feature).

The nine selection values live as `useState` in `builder-panel.tsx` (lines 82–96). All are
stable primitives/collections **except** `selectedExotic`, which is an *index* into a
live-inventory-derived list and must be persisted by identity instead.

---

## What persists — the blob

A single versioned JSON object in `localStorage` under key `stat-builder:selections`:

```ts
interface PersistedSelections {
  version: 1;
  classType: number | null;
  targets: number[];                    // length 6, STAT_ORDER
  major: number;                        // major-mod count 0–5
  setReqs: Record<number, 2 | 4>;       // set hash → required count
  exoticName: string | null;            // NOT the index — the dedupe key (see below)
  allowTuning: boolean;
  activeSubclass: Subclass;
  fragSel: Record<Subclass, number[]>;  // Sets serialized to arrays
}
```

**Three data-shape gotchas the module handles:**

1. **Exotic = name, not index.** `exotics` (`builder-panel.tsx:186`) is a `{name, hashes,
   icon}[]` rebuilt from the player's `pool` and sorted by name; `selectedExotic` indexes
   into it. The index is unstable (gear added, class switched, pool filtered → same index,
   different exotic). The dedupe key is `name`, so we persist `exotics[selectedExotic].name`
   and resolve it back to an index on load. If that exotic is no longer owned → leave unset.
2. **`fragSel` holds `Set`s.** JSON can't serialize a `Set` → store arrays, rehydrate to
   `Set` on load (skipping any unknown subclass key).
3. **`setReqs` has number keys.** `JSON.stringify` turns them into strings; coerce back with
   `Number(...)` on load.

**Deliberately omitted for v1:** `useLegacyArmor`. It's declared without a setter
(`builder-panel.tsx:96`) and its toggle is disabled, so it can't differ from `false` —
persisting it would be dead code. It becomes a one-field add to the schema when the legacy
toggle actually ships.

---

## 1. Storage module — `src/lib/builder/selection-storage.ts` (new)

The testable core. Pure except for the two `localStorage` touchpoints, both wrapped so a
private-mode / quota / corrupt-data failure never throws into React.

```ts
export const SELECTIONS_KEY = "stat-builder:selections";
export const SCHEMA_VERSION = 1;

export interface PersistedSelections { /* as above */ }

/** Read + parse + version-check + shape-guard. Returns null on ANY failure. */
export function loadSelections(): PersistedSelections | null;

/** Serialize + write. Swallows quota/security errors. */
export function saveSelections(sel: PersistedSelections): void;

// Small pure helpers (unit-tested directly):
export function fragSelToArrays(s: Record<Subclass, Set<number>>): Record<Subclass, number[]>;
export function fragSelFromArrays(a: Record<Subclass, number[]>): Record<Subclass, Set<number>>;
export function resolveExoticIndex(name: string | null, exotics: { name: string }[]): number | null;
```

`loadSelections` guards the shape defensively: wrong `version`, non-array `targets`,
missing keys, or a `JSON.parse` throw all return `null` → the builder falls back to its
current defaults. Bad stored data can never break the page.

---

## 2. Builder wiring — `src/components/builder/builder-panel.tsx`

Pure logic stays in the module; the component gets thin effects (~25 lines). No separate
hook — threading nine setters through one would be more indirection than it saves.

**Restore** — split by data dependency:

- **Inventory-independent fields** (`targets`, `major`, `setReqs`, `allowTuning`,
  `activeSubclass`, `fragSel`, and `classType` if non-null): a one-time mount effect calls
  `loadSelections()` and applies them. Stashes `exoticName` in a ref for the exotic effect,
  then sets a `restored` ref true.
- **Exotic** (`exoticName → selectedExotic`): an effect on `exotics` that, once the list is
  non-empty, sets `selectedExotic = resolveExoticIndex(stashedName, exotics)` (which returns
  the matching index, or `null` when the exotic isn't owned) and clears the ref so a later
  class switch can't re-apply it.

**Reconcile stale data** (guards against gear changing between sessions):

- **Class:** fold into the existing default effect (`:105`) so it also *corrects* an invalid
  restored class, not just fills a null one:
  `if (classType === null || !classes.includes(classType)) setClassType(classes[0])`.
- **Set reqs:** once `sets` loads, drop any `setReqs` entry whose hash isn't in the owned
  set list (a requirement for an unowned set would make every build infeasible).

**Save** — one debounced effect, keyed on all selection values plus `exotics` (needed to map
the index back to a name):

```ts
useEffect(() => {
  if (!restored.current) return;                 // don't clobber stored data pre-restore
  const id = setTimeout(() => saveSelections({
    version: SCHEMA_VERSION,
    classType, targets, major, setReqs,
    exoticName: selectedExotic === null ? null : (exotics[selectedExotic]?.name ?? null),
    allowTuning, activeSubclass,
    fragSel: fragSelToArrays(fragSel),
  }), 300);                                        // debounce slider drags
  return () => clearTimeout(id);
}, [classType, targets, major, setReqs, selectedExotic, exotics, allowTuning, activeSubclass, fragSel]);
```

The `restored` guard is essential: without it the effect fires on first render and writes
defaults over the stored blob before restore runs.

---

## Verification

- **Module (Node, `npx tsx`, then delete):** round-trip `save` → `load` equality;
  `fragSel` Set↔array; `setReqs` number-key coercion; `resolveExoticIndex` hit / miss / null;
  version mismatch → `null`; corrupt JSON → `null`. Same throwaway-bench discipline as the
  optimizer work.
- **`npx tsc --noEmit`** clean. Don't `npm run build` while the dev server runs.
- **End-to-end (Noah, signed in):** set a full build (class, targets, exotic, set req,
  fragments, tuning), refresh → everything returns and the optimizer re-runs. Then a stale
  case: pick an exotic, and confirm it degrades gracefully if not resolvable.

## Out of scope (later)

- Named / multiple saved builds and a save/load UI (this is auto-restore only).
- Cross-device sync (would need the per-user `membershipId` key + a backend).
- Shareable builds via URL params.
- Persisting `useLegacyArmor` — added when its toggle ships.
