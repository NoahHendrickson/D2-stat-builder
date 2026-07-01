# Fragments + Legacy-Armor Toggle — Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use `- [ ]` tracking. This repo
> has **no git** and **no test runner** — replace "commit" gates with the stated
> verification (`npx tsc --noEmit`, a throwaway `npx tsx` bench, or Noah's in-browser check).
> Don't `npm run build` while the dev server runs.

**Goal:** Let the player pick subclass fragments whose stat effects feed the optimizer as a
build-wide constant, and default the candidate pool to Tier-5 armor with a disabled
"legacy armor" toggle.

**Architecture:** Manifest-driven data module (`fragments.ts`) → new `OptimizerInput.fragmentBonus`
folded into `solve.ts` → `FragmentPicker` UI in the existing "Fragments" section → builder wiring.

**Tech Stack:** Next.js 16 / React 19 / TS / Tailwind v4 / shadcn, `bungie-api-ts`, Web Worker optimizer.

## Global Constraints

- Six stats in `STAT_ORDER` = `[weapons, health, class, grenade, super, melee]`; `StatArray` is length-6.
- Stat hashes: weapons `2996146975`, health `392767087`, class `1943323491`, grenade `1735777505`, super `144602215`, melee `4244567218`.
- Fragment category→subclass map (verified vs live manifest): `shared.arc.fragments`→Arc, `shared.solar.fragments`→Solar, `shared.void.fragments`→Void, **`shared.stasis.trinkets`→Stasis**, `shared.strand.fragments`→Strand, `shared.prism.fragments`→Prismatic.
- Stat cap 0–200; fragment stats may be negative and may hit multiple stats.
- Verify optimizer changes with a throwaway `src/lib/optimizer/__bench.ts` (`npx tsx …`), then delete.

---

### Task 1: Fragment data module

**Files:**
- Create: `src/lib/armory/fragments.ts`
- Verify: throwaway `src/lib/armory/__fragbench.ts` run against the downloaded `items.json`

**Interfaces:**
- Consumes: `Manifest` (`manifest.all("DestinyInventoryItemDefinition")`), `STAT_ORDER`/`STAT_HASH_TO_INDEX`/`StatArray` from `./stats`.
- Produces:
  ```ts
  export type Subclass = "Arc" | "Solar" | "Void" | "Stasis" | "Strand" | "Prismatic";
  export const SUBCLASSES: Subclass[]; // ["Arc","Solar","Void","Stasis","Strand","Prismatic"]
  export interface FragmentInfo { hash: number; name: string; icon?: string; subclass: Subclass; stats: StatArray; }
  export function availableFragments(manifest: Manifest): Record<Subclass, FragmentInfo[]>;
  ```

- [ ] **Step 1: Write `fragments.ts`.** Category map → subclass; iterate the item table; keep plugs whose `plug.plugCategoryIdentifier` is in the map AND have ≥1 armor-stat `investmentStats`; build `stats: StatArray` by summing `investmentStats` via `STAT_HASH_TO_INDEX`; group by subclass, sort by name.

```ts
import type { Manifest } from "@/lib/manifest/load";
import { STAT_HASH_TO_INDEX, type StatArray } from "./stats";

export type Subclass = "Arc" | "Solar" | "Void" | "Stasis" | "Strand" | "Prismatic";
export const SUBCLASSES: Subclass[] = ["Arc", "Solar", "Void", "Stasis", "Strand", "Prismatic"];

// Stasis fragments live under `shared.stasis.trinkets`, not `.fragments` — verified vs manifest.
const CATEGORY_SUBCLASS: Record<string, Subclass> = {
  "shared.arc.fragments": "Arc",
  "shared.solar.fragments": "Solar",
  "shared.void.fragments": "Void",
  "shared.stasis.trinkets": "Stasis",
  "shared.strand.fragments": "Strand",
  "shared.prism.fragments": "Prismatic",
};

export interface FragmentInfo {
  hash: number;
  name: string;
  icon?: string;
  subclass: Subclass;
  stats: StatArray;
}

/** Stat-affecting subclass fragments from the manifest, grouped by subclass. Not owned-gated. */
export function availableFragments(manifest: Manifest): Record<Subclass, FragmentInfo[]> {
  const out = { Arc: [], Solar: [], Void: [], Stasis: [], Strand: [], Prismatic: [] } as Record<Subclass, FragmentInfo[]>;
  const table = manifest.all("DestinyInventoryItemDefinition");
  for (const key in table) {
    const def = table[key];
    const cat = def.plug?.plugCategoryIdentifier;
    const subclass = cat ? CATEGORY_SUBCLASS[cat] : undefined;
    if (!subclass) continue;
    const stats: StatArray = [0, 0, 0, 0, 0, 0];
    let touches = false;
    for (const inv of def.investmentStats ?? []) {
      const idx = STAT_HASH_TO_INDEX[inv.statTypeHash];
      if (idx !== undefined) { stats[idx] += inv.value; touches = true; }
    }
    if (!touches) continue;
    out[subclass].push({
      hash: Number(key),
      name: def.displayProperties?.name ?? "Unknown",
      icon: def.displayProperties?.icon,
      subclass,
      stats,
    });
  }
  for (const s of SUBCLASSES) out[s].sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
```

- [ ] **Step 2: Verify counts against the real manifest.** Write `__fragbench.ts` that reuses the map over the already-downloaded `items.json` and asserts per-subclass counts (Arc 7, Solar 11, Void 11, Stasis 7, Strand 9, Prismatic 13). Run `npx tsx src/lib/armory/__fragbench.ts`; expect `PASS`. Delete it after.
- [ ] **Step 3: `npx tsc --noEmit`** → clean.

---

### Task 2: Optimizer — `fragmentBonus`

**Files:**
- Modify: `src/lib/optimizer/types.ts` (add `fragmentBonus?: StatArray` to `OptimizerInput`)
- Modify: `src/lib/optimizer/solve.ts`
- Verify: throwaway `src/lib/optimizer/__bench.ts` (`npx tsx`), then delete

**Interfaces:**
- Produces: `OptimizerInput.fragmentBonus?: StatArray` (length-6, may be negative; default zeros).

- [ ] **Step 1: types.** Add to `OptimizerInput`:
  ```ts
  /** Build-wide stat constant from selected subclass fragments (may be negative). */
  fragmentBonus?: StatArray;
  ```
- [ ] **Step 2: Write the failing bench.** In `__bench.ts`: a brute-force reference that adds `fragmentBonus` to each combo's base before deficits/mods/tuning, vs `solve()`. Include (a) a positive-fragment case, (b) a **negative-fragment** case that raises an effective minimum, (c) a fragment that alone bridges a target. Run `npx tsx …`; expect mismatch (solve ignores fragmentBonus).
- [ ] **Step 3: Implement in `solve.ts`.** Read `const frag = input.fragmentBonus ?? [0,0,0,0,0,0];`. Fold `frag[s]` into the effective base everywhere a stat is evaluated:
  - `canReachMin`: `sum[s] + frag[s] + sumTuneUp[s] + suffixStat[k][s] + maxModPoints < min[s]` → infeasible.
  - `optimizeTuning` fast path + slow path: initialise `aug[s] = sum[s] + frag[s]` (instead of `sum[s]`); keep `tuningBonus[s] = aug[s] - (sum[s] + frag[s])` so it stays a pure tuning delta; final `stats[s] = clamp(sum[s] + frag[s] + tuningBonus[s] + modBonus[s])`.
  - Total-prune bound stays admissible: add `Σ max(0, frag[s])` (positive part) to the suffix-total constant.
  - `baseStats` reported = piece sum only (unchanged); `stats` includes `frag`.
- [ ] **Step 4: Run bench** → `ALL PASS`, 40/40 (or chosen N) brute-force matches incl. the negative case.
- [ ] **Step 5:** `npx tsc --noEmit` clean; delete `__bench.ts`.

---

### Task 3: FragmentPicker component

**Files:**
- Create: `src/components/builder/fragment-picker.tsx`
- Verify: `npx tsc --noEmit`; visual check by Noah

**Interfaces:**
- Consumes: `FragmentInfo`, `Subclass`, `SUBCLASSES` from `@/lib/armory/fragments`; `STAT_ORDER`, `STAT_LABELS`; shadcn `Tabs`, `Toggle`; `BUNGIE_IMAGE_BASE`.
- Produces:
  ```ts
  export function FragmentPicker(props: {
    fragments: Record<Subclass, FragmentInfo[]>;
    activeSubclass: Subclass;
    onSubclassChange: (s: Subclass) => void;
    selected: Set<number>;
    onToggle: (hash: number) => void;
  }): JSX.Element;
  ```

- [ ] **Step 1: Build the component.** `Tabs` over `SUBCLASSES` (value=`activeSubclass`, onValueChange=`onSubclassChange`). Below, a grid `grid-cols-[1fr_repeat(6,auto)]`: header row = "Name" + `STAT_LABELS[key].slice(0,3)` for each `STAT_ORDER`; one row per `fragments[activeSubclass]` — a `Toggle` (SetToggle-style, `pressed={selected.has(f.hash)}`), the name (+ optional `next/image` icon via `BUNGIE_IMAGE_BASE`), and per stat column show `f.stats[i]` when non-zero (`text-sky-400` for +, `text-red-400` for −), else blank. Empty-state text if the subclass list is empty.
- [ ] **Step 2:** `npx tsc --noEmit` clean.

---

### Task 4: Builder wiring + legacy toggle

**Files:**
- Modify: `src/components/builder/builder-panel.tsx`
- Verify: `npx tsc --noEmit`; Noah in-browser

**Interfaces:**
- Consumes: `availableFragments`, `FragmentPicker`, `Subclass`, `SUBCLASSES`.

- [ ] **Step 1: State + data.**
  ```ts
  const [activeSubclass, setActiveSubclass] = useState<Subclass>("Prismatic");
  const [fragSel, setFragSel] = useState<Record<Subclass, Set<number>>>(() =>
    Object.fromEntries(SUBCLASSES.map((s) => [s, new Set<number>()])) as Record<Subclass, Set<number>>);
  const [useLegacyArmor] = useState(false); // control disabled for now
  const fragments = useMemo(() => (manifest ? availableFragments(manifest) : null), [manifest]);
  ```
- [ ] **Step 2: Derived fragmentBonus + toggle handler.**
  ```ts
  const fragmentBonus = useMemo(() => {
    const v = [0, 0, 0, 0, 0, 0];
    if (!fragments) return v;
    for (const h of fragSel[activeSubclass]) {
      const f = fragments[activeSubclass].find((x) => x.hash === h);
      if (f) for (let i = 0; i < 6; i++) v[i] += f.stats[i];
    }
    return v;
  }, [fragments, fragSel, activeSubclass]);
  const toggleFragment = (hash: number) => setFragSel((prev) => {
    const next = new Set(prev[activeSubclass]);
    next.has(hash) ? next.delete(hash) : next.add(hash);
    return { ...prev, [activeSubclass]: next };
  });
  ```
- [ ] **Step 3: Candidate pool filter (legacy).** Add a `pool` memo and use it for `slots`, `sets`, `exotics`:
  ```ts
  const pool = useMemo(() => useLegacyArmor ? classPieces : classPieces.filter((p) => p.tunedStat !== undefined), [classPieces, useLegacyArmor]);
  ```
  Replace `classPieces` with `pool` in the `sets` memo, `exotics` memo, and the `slots` mapping inside `runOptimizer`.
- [ ] **Step 4: Pass fragmentBonus.** Add `fragmentBonus` to the `run({...})` input and to `runOptimizer`'s dep array.
- [ ] **Step 5: Render.** Replace the "coming soon" body of `<Section title="Fragments">` with `fragments && <FragmentPicker fragments={fragments} activeSubclass={activeSubclass} onSubclassChange={setActiveSubclass} selected={fragSel[activeSubclass]} onToggle={toggleFragment} />`. Add a new `<Section title="Armor pool">` after the Tier-5 tuning section with a disabled `Toggle` "Use legacy armor" + helper "Coming soon — includes Armor 2.0 / artifice pieces."
- [ ] **Step 6:** `npx tsc --noEmit` clean; hand to Noah to verify grid + a build vs D2AP.

---

## Self-Review

- **Spec coverage:** data (T1), optimizer+bench (T2), UI grid+tabs (T3), wiring+state+legacy toggle (T4) — all spec sections covered.
- **Placeholders:** none — concrete code per step.
- **Type consistency:** `Subclass`, `FragmentInfo`, `availableFragments`, `fragmentBonus` names consistent across tasks; `StatArray` length-6 throughout.
