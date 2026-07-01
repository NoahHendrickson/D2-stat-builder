# Fragments selection + legacy-armor toggle — design

**Date:** 2026-07-01 · **Status:** design approved, pending spec review

## Goal

Let the player pick subclass **fragments** and have their stat effects flow into the
optimizer as a build-wide constant — mirroring D2ArmorPicker's fragment picker. Plus a
**"Use legacy armor"** toggle that defaults the optimizer to Tier-5 armor only (legacy /
artifice support lands later).

Two independent pieces, shipped together:
1. Fragments — data → optimizer → UI.
2. Legacy-armor toggle — a candidate-pool filter + a disabled "coming soon" control.

---

## 1. Data — `src/lib/armory/fragments.ts` (new)

Fragments are plug items in the manifest item table (already downloaded — kept by the
existing `def.plug` filter in `manifest/load.ts`). Enumerate at runtime, like `sets.ts`.

**Detection.** A plug is a stat-affecting fragment when its `plug.plugCategoryIdentifier`
is in this map **and** it has `investmentStats` on any of the six armor stats:

| plugCategoryIdentifier      | subclass   |
| --------------------------- | ---------- |
| `shared.arc.fragments`      | Arc        |
| `shared.solar.fragments`    | Solar      |
| `shared.void.fragments`     | Void       |
| `shared.stasis.trinkets`    | Stasis     |
| `shared.strand.fragments`   | Strand     |
| `shared.prism.fragments`    | Prismatic  |

⚠ **Gotcha (verified against the live manifest):** Stasis fragments use
`shared.stasis.trinkets` — *not* `.fragments`. A naive `includes("fragment")` filter
silently drops all of Stasis. Use the explicit category→subclass map above. (58
stat-affecting fragments total; fragments may hit multiple stats and may exceed ±10, e.g.
Echo of Dilation `weapons+10 super+10`, Whisper of Hunger `melee−20`.)

**Exports:**

```ts
export type Subclass = "Arc" | "Solar" | "Void" | "Stasis" | "Strand" | "Prismatic";
export const SUBCLASSES: Subclass[]; // fixed tab order above

export interface FragmentInfo {
  hash: number;
  name: string;
  icon?: string;
  subclass: Subclass;
  stats: StatArray; // summed investmentStats on the 6 armor stats, in STAT_ORDER (may be negative)
}

/** All stat-affecting fragments grouped by subclass, sorted by name. Manifest-driven, not owned-gated. */
export function availableFragments(manifest: Manifest): Record<Subclass, FragmentInfo[]>;
```

Fragments are theoretical (any fragment selectable, not restricted to owned/unlocked) —
matches D2AP.

---

## 2. Optimizer — `src/lib/optimizer/{types,solve}.ts`

- Add `OptimizerInput.fragmentBonus?: StatArray` — the summed stats of the selected
  fragments (build-wide constant; defaults to all-zero).
- In `solve()`, fold it into every loadout's effective stats **before** the target /
  deficit checks: conceptually `effectiveBase[s] = pieceSum[s] + fragmentBonus[s]`, then
  tuning + mods work against that. Final reported `stats[s] = clamp(pieceSum[s] +
  fragmentBonus[s] + tuningBonus[s] + modBonus[s], 0, 200)`, `total = Σ stats`.
- `canReachMin` pruning must include `fragmentBonus` (it can be **negative**, which
  raises effective minimums). Keep pruning admissible.
- `OptimizerLoadout.baseStats` stays **piece-only** (unchanged meaning); `stats` becomes
  fragment-inclusive. Consumers that want the fragment contribution read it from the
  input (it's constant across all loadouts) — no new per-loadout field.
- **Verify** with a throwaway Node bench (`npx tsx`, then delete): brute-force
  cross-check that the pruned solver still matches, including a **negative-fragment**
  scenario and a fragment-that-bridges-a-target scenario. Same discipline as tuning.

---

## 3. UI — `src/components/builder/fragment-picker.tsx` (new)

Presentational component (like `ExoticPicker`), rendered inside the existing
`<Section title="Fragments">` in `builder-panel.tsx` (currently a "coming soon"
placeholder, already positioned directly below Set bonuses).

**Props:**

```ts
{
  fragments: Record<Subclass, FragmentInfo[]>;
  activeSubclass: Subclass;
  onSubclassChange: (s: Subclass) => void;
  selected: Set<number>;        // fragment hashes toggled in the active subclass
  onToggle: (hash: number) => void;
}
```

**Layout:**
- Subclass tabs across the top (Arc · Solar · Void · Stasis · Strand · Prismatic) using
  the shadcn `Tabs` already used for class / mod budget.
- A grid below: a **Name** column + six stat columns. Header uses the 3-letter stat
  abbreviations already used in the results row (`Wea Hea Cla Gre Sup Mel`).
- Each fragment row: a `SetToggle`-style toggle, the fragment name (+ icon via
  `BUNGIE_IMAGE_BASE` when present), and its `+10` / `−10` under the matching stat
  column (green for +, red for −; blank where zero). Switching tabs swaps the grid.

---

## 4. Builder wiring — `src/components/builder/builder-panel.tsx`

- State: `activeSubclass: Subclass` (default `"Prismatic"`), and
  `fragSel: Record<Subclass, Set<number>>` — per-subclass selection persists across tab
  switches; **only the active subclass's fragments apply**.
- `fragments = useMemo(() => availableFragments(manifest), [manifest])`.
- `fragmentBonus = useMemo(sum of stats over fragSel[activeSubclass])` → pass into
  `run({ ..., fragmentBonus })`.
- Fragments are subclass-based, independent of armor class → **do not** reset selection
  on class change (unlike set/exotic).
- Replace the placeholder inside `<Section title="Fragments">` with `<FragmentPicker …/>`.

---

## 5. Legacy-armor toggle — `builder-panel.tsx`

- Add a new `<Section title="Armor pool">` placed immediately after the Tier-5 tuning
  section, containing a disabled `Toggle` labeled **"Use legacy armor"** with helper text
  *"Coming soon — includes Armor 2.0 / artifice pieces."*
- State `useLegacyArmor` (default `false`; the control is disabled, so it stays false for
  now).
- Filter the candidate pool fed to the optimizer to **Tier-5 only** when off:
  `const pool = useLegacyArmor ? classPieces : classPieces.filter(p => p.tunedStat !== undefined);`
  Use `pool` for the `slots` mapping (and, reasonably, for `sets`/`exotics` so the whole
  builder reflects the T5-only pool).
- **Accepted consequence:** Armor 2.0 exotics (no tuning socket) are excluded until legacy
  is enabled — an exotic that exists only in its 2.0 version won't be selectable yet.

---

## Verification

- Optimizer: Node bench (brute-force + negative-fragment + target-bridging cases), deleted
  after — perf sanity like tuning.
- Data + UI: Noah reloads, opens Fragments, confirms the per-subclass grid (incl. Stasis)
  matches the game / D2AP, and that generated builds reflect the fragment stats; cross-check
  a build's totals against D2AP.
- `npx tsc --noEmit` clean. Don't `npm run build` while the dev server runs.

## Out of scope (later)

- Aspect / fragment-slot-count enforcement — free multi-select for now.
- Artifice `+3` in the optimizer — the legacy toggle stays disabled until then.
- Non-stat fragment effects — irrelevant to stat optimization.
- Stat icons in the grid header — text abbreviations for v1.
