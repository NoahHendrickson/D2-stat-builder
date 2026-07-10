# Apply Current fragments — design

- **Date:** 2026-07-09
- **Status:** Approved (design)
- **Area:** `src/lib/armory`, `src/lib/dim/subclasses`, `src/components/builder`

## Goal

Add an **Apply Current** button on the Fragment section that reads the equipped
subclass and fragments from the character matching the app’s selected class, then
switches the subclass tab and **replaces** that subclass’s fragment selection so the
picker matches what’s on the character.

## Context (what exists today)

- Profile proxy already requests CharacterEquipment (`205`) and ItemSockets (`305`):
  [profile/route.ts](../../../src/app/api/bungie/profile/route.ts).
- Subclass item hashes and fragment socket index ranges are hardcoded in
  [subclasses.ts](../../../src/lib/dim/subclasses.ts) (`SUBCLASS_ITEM_HASHES`,
  `FRAGMENT_SOCKET_START`) because the cached manifest drops subclass defs.
- Fragment picker only lists **stat-affecting** fragments
  ([fragments.ts](../../../src/lib/armory/fragments.ts)); non-stat plugs are out of
  scope for the optimizer.
- Builder selects by **class** (`classType`), not character id. Emblem tabs already
  resolve “one character per class” as most-recently-played of that class
  ([class-emblem-tabs.tsx](../../../src/components/builder/class-emblem-tabs.tsx)).
- `fetchArmory` currently normalizes armor only and discards equipped subclass /
  socket data beyond armor plugs ([fetch.ts](../../../src/lib/armory/fetch.ts)).

## Decisions (locked)

| Topic | Choice |
| ----- | ------ |
| Selection semantics | **Replace** `fragSel` for the equipped subclass (do not merge; other subclasses untouched) |
| Subclass tab | **Switch** to the character’s equipped subclass |
| Non-stat equipped fragments | **Ignore silently** (only apply hashes present in the picker) |
| Freshness | **Refetch profile on click**, then apply (no page reload) |
| Which character | Character for the **currently selected app class** (`classType`); if two of that class, most-recently-played (same rule as emblem tabs) |
| Other subclasses’ saved picks | Leave untouched |

## Design

### 1. Data — equipped subclass snapshot on armory

During profile → armory normalization, for each character extract:

```ts
export interface EquippedSubclass {
  subclass: Subclass;
  /** Plug hashes in fragment sockets (may include non-stat fragments). */
  fragmentHashes: number[];
}
```

**Algorithm** (per character id):

1. Scan `profile.characterEquipment.data[characterId].items`.
2. Find the item whose `itemHash` is in the flat set of `SUBCLASS_ITEM_HASHES` values;
   map hash → `Subclass`.
3. Read `profile.itemComponents.sockets.data[instanceId].sockets`.
4. Take plug hashes from indices
   `[FRAGMENT_SOCKET_START[subclass], FRAGMENT_SOCKET_START[subclass] + 5]`
   (six fragment sockets), skipping empty / zero plugs.
5. Attach as optional `equippedSubclass?: EquippedSubclass` on each `ArmoryCharacter`.
   Characters with no recognizable subclass item omit the field.

No new Bungie components. No manifest subclass defs required.

### 2. Click flow — builder panel

Wire from `FragmentPicker` / Fragments section:

1. Disable the button and show a brief loading state.
2. `await armoryQuery.refetch()` — same `/api/bungie/profile` path already used after
   equip; **not** a full page reload.
3. Resolve character: among `armory.characters` with `classType === selected classType`,
   pick the one with the latest `dateLastPlayed` (reuse emblem-tab helper or equivalent).
4. Read that character’s `EquippedSubclass`.
5. If missing: keep current selection; show a short inline/toast error; re-enable button.
6. Otherwise:
   - `setActiveSubclass(equipped.subclass)`
   - Build `next = new Set(equipped.fragmentHashes.filter(h => knownHashes.has(h)))`
     where `knownHashes` is the set of hashes in `availableFragments` for that subclass
   - `setFragSel(prev => ({ ...prev, [equipped.subclass]: next }))`
7. Re-enable button.

Optimizer / persistence already react to `activeSubclass` + `fragSel` changes (including
localStorage save) — no special casing beyond the state update.

### 3. UI — Fragment section

- Add an **Apply Current** control near the Fragment section header or beside the
  subclass tabs (match existing section button density; no new card chrome).
- Disabled when: not signed in, armory not ready, no `classType`, or refetch in flight.
- Loading: button-local spinner / disabled label only — do not block the rest of the
  builder or remount the page.

### 4. Errors & edge cases

| Case | Behavior |
| ---- | -------- |
| Refetch fails | Keep selection; short error; button re-enabled |
| No subclass on character equipment | Keep selection; short error |
| Equipped plugs include non-stat fragments | Applied set is the intersection with picker hashes; no message |
| Zero fragment sockets filled | Switch subclass tab; replace selection with empty set |
| Two characters of same class | Most-recently-played of that class |

### 5. Performance

- One existing profile fetch on click (already paid cost elsewhere).
- No manifest re-download, no full page navigation.
- Parsing is a small scan of one character’s equipment + ~6 socket slots.

## Out of scope

- Applying aspects, abilities, or non-stat fragment effects
- Enforcing fragment slot / aspect capacity
- Per-character (vs per-class) selection in the builder UI
- Auto-apply on class tab change or on a polling interval

## Verification

- Unit tests for equipped-subclass extraction: known subclass hash → subclass + fragment
  plugs; empty sockets; unknown item ignored; Prismatic socket start (9) vs others (7).
- Manual: sign in, equip a subclass + mix of stat/non-stat fragments in-game, hit Apply
  Current on the matching class tab → tab + checkboxes match; switch class tab → applies
  the other character; change subclass in-game, Apply again → updates without reload.
- `npx tsc --noEmit` clean. Don’t `npm run build` while the dev server runs.
