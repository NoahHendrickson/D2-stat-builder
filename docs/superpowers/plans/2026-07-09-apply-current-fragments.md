# Apply Current Fragments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an **Apply Current** button on the Fragment section that refetches the profile, reads the equipped subclass/fragments for the app-selected class’s character, switches the subclass tab, and replaces that subclass’s fragment selection.

**Architecture:** Pure extraction from the existing Destiny profile (equipment + sockets) → attach `equippedSubclass` on each `ArmoryCharacter` during `fetchArmory` → on button click, `armoryQuery.refetch()`, resolve character by selected `classType`, intersect equipped plugs with known stat-affecting fragment hashes, update `activeSubclass` + `fragSel`.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Vitest / TanStack Query / sonner toasts / Phosphor `CircleNotch` / existing `Button` + `FragmentPicker`.

**Branch:** `feature/apply-current-fragments` (already checked out). Spec: `docs/superpowers/specs/2026-07-09-apply-current-fragments-design.md`.

## Global Constraints

- No new Bungie profile components — reuse `205` (CharacterEquipment) + `305` (ItemSockets).
- No page reload; only `armoryQuery.refetch()` on click.
- Replace (not merge) `fragSel` for the equipped subclass; leave other subclasses untouched.
- Switch subclass tab to the equipped subclass.
- Silently ignore non-stat fragment plugs (intersect with `availableFragments` hashes only).
- Character = selected app `classType`; if two of that class, most-recently-played (`dateLastPlayed`).
- Don’t `npm run build` while the dev server runs; use `npx tsc --noEmit` and `npm test`.
- No inline imports; exhaustive `switch` with `never` default when switching unions/enums.

## File structure

| File | Responsibility |
| ---- | -------------- |
| `src/lib/dim/subclasses.ts` | Add reverse map `subclassFromItemHash(hash)` (hash → Subclass). |
| `src/lib/armory/equipped-subclass.ts` | Pure `equippedSubclassForCharacter(profile, characterId)`. |
| `src/lib/armory/equipped-subclass.test.ts` | Unit tests for extraction. |
| `src/lib/armory/character-for-class.ts` | `characterForClass(characters, classType)` — most-recently-played of class. |
| `src/lib/armory/character-for-class.test.ts` | Unit tests for character pick. |
| `src/lib/armory/fetch.ts` | Attach `equippedSubclass?` on each `ArmoryCharacter`. |
| `src/components/builder/fragment-picker.tsx` | Apply Current button UI + loading/disabled props. |
| `src/components/builder/builder-panel.tsx` | Click handler: refetch → resolve → apply state. |

---

### Task 1: Reverse subclass hash lookup + equipped-subclass extraction

**Files:**
- Modify: `src/lib/dim/subclasses.ts`
- Create: `src/lib/armory/equipped-subclass.ts`
- Create: `src/lib/armory/equipped-subclass.test.ts`

**Interfaces:**
- Consumes: `SUBCLASS_ITEM_HASHES`, `FRAGMENT_SOCKET_START` from `../dim/subclasses`; `Subclass` from `./fragments`; `DestinyProfileResponse` from `bungie-api-ts/destiny2`.
- Produces:
  ```ts
  export function subclassFromItemHash(itemHash: number): Subclass | undefined;
  export interface EquippedSubclass {
    subclass: Subclass;
    fragmentHashes: number[];
  }
  export function equippedSubclassForCharacter(
    profile: DestinyProfileResponse,
    characterId: string,
  ): EquippedSubclass | undefined;
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/armory/equipped-subclass.test.ts`:

```ts
import { test, expect } from "vitest";
import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";
import { SUBCLASS_ITEM_HASHES } from "@/lib/dim/subclasses";
import { equippedSubclassForCharacter } from "./equipped-subclass";

const CHAR = "char1";
const SOLAR_HUNTER = SUBCLASS_ITEM_HASHES.Solar[1]; // 2240888816
const PRISMATIC_WARLOCK = SUBCLASS_ITEM_HASHES.Prismatic[2]; // 3893112950

function mkProfile(opts: {
  itemHash: number;
  instanceId: string;
  /** Sparse socket list; length must cover fragment indices used. */
  sockets: (number | undefined)[];
}): DestinyProfileResponse {
  return {
    characterEquipment: {
      data: {
        [CHAR]: {
          items: [{ itemHash: opts.itemHash, itemInstanceId: opts.instanceId }],
        },
      },
    },
    itemComponents: {
      sockets: {
        data: {
          [opts.instanceId]: {
            sockets: opts.sockets.map((plugHash) =>
              plugHash == null ? {} : { plugHash },
            ),
          },
        },
      },
    },
  } as unknown as DestinyProfileResponse;
}

test("reads Solar fragment plugs from sockets 7–12", () => {
  // indices 0–6 empty fillers; 7–12 = fragments
  const sockets: (number | undefined)[] = Array(13).fill(undefined);
  sockets[7] = 11;
  sockets[8] = 22;
  sockets[12] = 33;
  const got = equippedSubclassForCharacter(
    mkProfile({ itemHash: SOLAR_HUNTER, instanceId: "sub1", sockets }),
    CHAR,
  );
  expect(got).toEqual({ subclass: "Solar", fragmentHashes: [11, 22, 33] });
});

test("reads Prismatic fragment plugs from sockets 9–14", () => {
  const sockets: (number | undefined)[] = Array(15).fill(undefined);
  sockets[9] = 100;
  sockets[14] = 200;
  const got = equippedSubclassForCharacter(
    mkProfile({ itemHash: PRISMATIC_WARLOCK, instanceId: "sub2", sockets }),
    CHAR,
  );
  expect(got).toEqual({ subclass: "Prismatic", fragmentHashes: [100, 200] });
});

test("skips empty / zero plugs", () => {
  const sockets: (number | undefined)[] = Array(13).fill(undefined);
  sockets[7] = 0;
  sockets[8] = 55;
  const got = equippedSubclassForCharacter(
    mkProfile({ itemHash: SOLAR_HUNTER, instanceId: "sub3", sockets }),
    CHAR,
  );
  expect(got).toEqual({ subclass: "Solar", fragmentHashes: [55] });
});

test("returns undefined when no subclass item is equipped", () => {
  const profile = {
    characterEquipment: {
      data: { [CHAR]: { items: [{ itemHash: 999, itemInstanceId: "x" }] } },
    },
    itemComponents: { sockets: { data: {} } },
  } as unknown as DestinyProfileResponse;
  expect(equippedSubclassForCharacter(profile, CHAR)).toBeUndefined();
});

test("returns undefined for unknown character id", () => {
  expect(
    equippedSubclassForCharacter(
      mkProfile({
        itemHash: SOLAR_HUNTER,
        instanceId: "sub1",
        sockets: Array(13).fill(1),
      }),
      "missing",
    ),
  ).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/armory/equipped-subclass.test.ts`

Expected: FAIL (module / exports missing).

- [ ] **Step 3: Add `subclassFromItemHash` to `src/lib/dim/subclasses.ts`**

Append (keep existing exports):

```ts
import type { Subclass } from "../armory/fragments";
// ... existing SUBCLASS_ITEM_HASHES + FRAGMENT_SOCKET_START ...

/** Reverse lookup: subclass item hash → Subclass. Built once from SUBCLASS_ITEM_HASHES. */
const ITEM_HASH_TO_SUBCLASS: Map<number, Subclass> = (() => {
  const m = new Map<number, Subclass>();
  for (const subclass of Object.keys(SUBCLASS_ITEM_HASHES) as Subclass[]) {
    for (const hash of Object.values(SUBCLASS_ITEM_HASHES[subclass])) {
      m.set(hash, subclass);
    }
  }
  return m;
})();

export function subclassFromItemHash(itemHash: number): Subclass | undefined {
  return ITEM_HASH_TO_SUBCLASS.get(itemHash);
}
```

Note: `Object.keys(SUBCLASS_ITEM_HASHES)` is fine; do not add a circular import — `subclasses.ts` already imports `Subclass` from `../armory/fragments`.

- [ ] **Step 4: Implement `src/lib/armory/equipped-subclass.ts`**

```ts
import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";
import {
  FRAGMENT_SOCKET_START,
  subclassFromItemHash,
} from "@/lib/dim/subclasses";
import type { Subclass } from "./fragments";

const FRAGMENT_SOCKET_COUNT = 6;

export interface EquippedSubclass {
  subclass: Subclass;
  /** Plug hashes in fragment sockets (may include non-stat fragments). */
  fragmentHashes: number[];
}

/** Equipped subclass + fragment plug hashes for one character, or undefined if none. */
export function equippedSubclassForCharacter(
  profile: DestinyProfileResponse,
  characterId: string,
): EquippedSubclass | undefined {
  const items = profile.characterEquipment?.data?.[characterId]?.items;
  if (!items) return undefined;

  let subclass: Subclass | undefined;
  let instanceId: string | undefined;
  for (const item of items) {
    const sc = subclassFromItemHash(item.itemHash);
    if (sc && item.itemInstanceId) {
      subclass = sc;
      instanceId = item.itemInstanceId;
      break;
    }
  }
  if (!subclass || !instanceId) return undefined;

  const sockets =
    profile.itemComponents?.sockets?.data?.[instanceId]?.sockets ?? [];
  const start = FRAGMENT_SOCKET_START[subclass];
  const fragmentHashes: number[] = [];
  for (let i = 0; i < FRAGMENT_SOCKET_COUNT; i++) {
    const plugHash = sockets[start + i]?.plugHash;
    if (plugHash) fragmentHashes.push(plugHash);
  }

  return { subclass, fragmentHashes };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/armory/equipped-subclass.test.ts`

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dim/subclasses.ts src/lib/armory/equipped-subclass.ts src/lib/armory/equipped-subclass.test.ts
git commit -m "$(cat <<'EOF'
Add equipped subclass extraction from profile sockets.

EOF
)"
```

---

### Task 2: Character-for-class helper

**Files:**
- Create: `src/lib/armory/character-for-class.ts`
- Create: `src/lib/armory/character-for-class.test.ts`

**Interfaces:**
- Consumes: `ArmoryCharacter` from `./fetch` (type-only — avoid runtime cycle by accepting a minimal shape if needed).
- Produces:
  ```ts
  export function characterForClass<T extends { classType: number; dateLastPlayed: string }>(
    characters: T[],
    classType: number,
  ): T | undefined;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { test, expect } from "vitest";
import { characterForClass } from "./character-for-class";

test("picks the most-recently-played character of the given class", () => {
  const chars = [
    { id: "a", classType: 1, dateLastPlayed: "2026-01-01T00:00:00Z" },
    { id: "b", classType: 1, dateLastPlayed: "2026-06-01T00:00:00Z" },
    { id: "c", classType: 2, dateLastPlayed: "2026-07-01T00:00:00Z" },
  ];
  expect(characterForClass(chars, 1)?.id).toBe("b");
  expect(characterForClass(chars, 2)?.id).toBe("c");
});

test("returns undefined when no character matches the class", () => {
  expect(characterForClass([{ id: "a", classType: 0, dateLastPlayed: "2026-01-01T00:00:00Z" }], 1)).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/armory/character-for-class.test.ts`

Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
/** Most-recently-played character of `classType`, or undefined if none. */
export function characterForClass<
  T extends { classType: number; dateLastPlayed: string },
>(characters: T[], classType: number): T | undefined {
  let best: T | undefined;
  for (const c of characters) {
    if (c.classType !== classType) continue;
    if (!best || c.dateLastPlayed > best.dateLastPlayed) best = c;
  }
  return best;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/armory/character-for-class.test.ts`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/armory/character-for-class.ts src/lib/armory/character-for-class.test.ts
git commit -m "$(cat <<'EOF'
Add characterForClass helper for Apply Current.

EOF
)"
```

---

### Task 3: Attach `equippedSubclass` on armory characters

**Files:**
- Modify: `src/lib/armory/fetch.ts`

**Interfaces:**
- Consumes: `equippedSubclassForCharacter` from `./equipped-subclass`; `EquippedSubclass` type.
- Produces: `ArmoryCharacter.equippedSubclass?: EquippedSubclass`

- [ ] **Step 1: Extend `ArmoryCharacter` and populate in `fetchArmory`**

In `src/lib/armory/fetch.ts`:

```ts
import type {
  DestinyColor,
  DestinyProfileResponse,
} from "bungie-api-ts/destiny2";
import type { Manifest } from "@/lib/manifest/load";
import { normalizeArmory, type ArmorPiece } from "./normalize";
import {
  equippedSubclassForCharacter,
  type EquippedSubclass,
} from "./equipped-subclass";

export interface ArmoryCharacter {
  id: string;
  classType: number;
  light: number;
  emblemBackgroundPath: string;
  emblemColor?: DestinyColor;
  dateLastPlayed: string;
  /** Equipped subclass + fragment plugs from live sockets; omitted if none. */
  equippedSubclass?: EquippedSubclass;
}

// ... Armory, ArmoryError unchanged ...

export async function fetchArmory(manifest: Manifest): Promise<Armory> {
  // ... existing fetch / error handling ...

  const profile = (await res.json()) as DestinyProfileResponse;
  const pieces = normalizeArmory(profile, manifest);
  const characters: ArmoryCharacter[] = Object.values(
    profile.characters?.data ?? {},
  ).map((c) => {
    const equippedSubclass = equippedSubclassForCharacter(
      profile,
      c.characterId,
    );
    return {
      id: c.characterId,
      classType: c.classType,
      light: c.light,
      emblemBackgroundPath: c.emblemBackgroundPath,
      emblemColor: c.emblemColor,
      dateLastPlayed: c.dateLastPlayed,
      ...(equippedSubclass ? { equippedSubclass } : {}),
    };
  });

  return { pieces, characters };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean (no callers break — new optional field).

- [ ] **Step 3: Commit**

```bash
git add src/lib/armory/fetch.ts
git commit -m "$(cat <<'EOF'
Attach equipped subclass snapshot to armory characters.

EOF
)"
```

---

### Task 4: Apply Current UI + builder wiring

**Files:**
- Modify: `src/components/builder/fragment-picker.tsx`
- Modify: `src/components/builder/builder-panel.tsx` (Fragments section ~976–985, plus handler near `toggleFragment`)

**Interfaces:**
- Consumes: `armoryQuery.refetch()`, `characterForClass`, `fragments` / `fragSel` / `setActiveSubclass` / `setFragSel`, `toast` from `sonner`, `CircleNotch` from Phosphor, `Button`.
- Produces: Apply Current control that refetches then replaces selection.

- [ ] **Step 1: Extend `FragmentPicker` with Apply Current button**

Update props and header row in `fragment-picker.tsx`:

```tsx
"use client";

import Image from "next/image";
import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { BUNGIE_IMAGE_BASE } from "@/lib/bungie/constants";
import { STAT_LABELS, STAT_ORDER, type StatIconMap } from "@/lib/armory/stats";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SUBCLASSES,
  type FragmentInfo,
  type Subclass,
} from "@/lib/armory/fragments";

export function FragmentPicker({
  fragments,
  activeSubclass,
  onSubclassChange,
  selected,
  onToggle,
  statIcons,
  onApplyCurrent,
  applyDisabled,
  applyLoading,
}: {
  fragments: Record<Subclass, FragmentInfo[]>;
  activeSubclass: Subclass;
  onSubclassChange: (s: Subclass) => void;
  selected: Set<number>;
  onToggle: (hash: number) => void;
  statIcons: StatIconMap;
  onApplyCurrent?: () => void;
  applyDisabled?: boolean;
  applyLoading?: boolean;
}) {
  const rows = fragments[activeSubclass];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={activeSubclass}
          onValueChange={(v) => onSubclassChange(v as Subclass)}
        >
          <TabsList>
            {SUBCLASSES.map((s) => (
              <TabsTrigger key={s} value={s} className="text-xs">
                {s}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {onApplyCurrent && (
          <Button
            type="button"
            variant="outlineSubtle"
            size="xs"
            disabled={applyDisabled || applyLoading}
            onClick={onApplyCurrent}
          >
            {applyLoading ? (
              <CircleNotch className="animate-spin" aria-hidden />
            ) : null}
            Apply Current
          </Button>
        )}
      </div>

      {/* ... existing empty / grid body unchanged ... */}
    </div>
  );
}
```

Keep the existing fragment grid body exactly as today (only wrap the tabs + add the button).

- [ ] **Step 2: Wire handler in `builder-panel.tsx`**

Add imports:

```ts
import { toast } from "sonner";
import { characterForClass } from "@/lib/armory/character-for-class";
```

Near `toggleFragment`, add state + handler:

```ts
const [applyingFragments, setApplyingFragments] = useState(false);

const applyCurrentFragments = async () => {
  if (classType === null || !fragments) return;
  setApplyingFragments(true);
  try {
    const result = await armoryQuery.refetch();
    if (result.error || !result.data) {
      toast.error("Couldn't refresh profile — try again");
      return;
    }
    const character = characterForClass(result.data.characters, classType);
    const equipped = character?.equippedSubclass;
    if (!equipped) {
      toast.error("No subclass found on this character");
      return;
    }
    const known = new Set(fragments[equipped.subclass].map((f) => f.hash));
    const next = new Set(
      equipped.fragmentHashes.filter((h) => known.has(h)),
    );
    setActiveSubclass(equipped.subclass);
    setFragSel((prev) => ({ ...prev, [equipped.subclass]: next }));
  } finally {
    setApplyingFragments(false);
  }
};
```

Pass into `FragmentPicker` (existing Fragments section):

```tsx
<FragmentPicker
  fragments={fragments}
  activeSubclass={activeSubclass}
  onSubclassChange={setActiveSubclass}
  selected={fragSel[activeSubclass]}
  onToggle={toggleFragment}
  statIcons={statIcons}
  onApplyCurrent={() => void applyCurrentFragments()}
  applyDisabled={classType === null || !armory}
  applyLoading={applyingFragments}
/>
```

Only render Apply props when `fragments` is defined (same guard as today — picker is inside `{fragments && (...)}`).

- [ ] **Step 3: Typecheck + unit tests**

Run:

```bash
npx tsc --noEmit
npx vitest run src/lib/armory/equipped-subclass.test.ts src/lib/armory/character-for-class.test.ts
```

Expected: clean / all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/builder/fragment-picker.tsx src/components/builder/builder-panel.tsx
git commit -m "$(cat <<'EOF'
Add Apply Current button for equipped fragments.

EOF
)"
```

- [ ] **Step 5: Manual verification (Noah)**

1. Sign in; open Fragments on Titan (or whichever class is selected).
2. In-game, equip a subclass + mix of stat and non-stat fragments.
3. Click **Apply Current** — no page reload; brief button loading; subclass tab switches; only stat-affecting fragments check on.
4. Switch app class tab; Apply again — uses that class’s character.
5. Change subclass in-game; Apply again — updates from fresh refetch.
6. Force a failure (optional: offline) — toast error; previous selection kept.

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| Extract equipped subclass + fragment sockets | Task 1 |
| Attach on `ArmoryCharacter` | Task 3 |
| Character = selected `classType` (MRP if ties) | Task 2 + 4 |
| Refetch on click, no page reload | Task 4 |
| Replace selection; switch subclass tab | Task 4 |
| Silent non-stat intersection | Task 4 |
| Button loading / disabled / toast errors | Task 4 |
| Unit tests for extraction + Prismatic socket start | Task 1 |
| Leave other subclasses’ `fragSel` untouched | Task 4 (`setFragSel` spreads `prev`) |

## Self-review notes

- No placeholders; exact paths and code included.
- `EquippedSubclass` / `equippedSubclassForCharacter` / `characterForClass` / `subclassFromItemHash` names consistent across tasks.
- `fetch.ts` does not need the manifest for subclass extraction (hashes are hardcoded) — `manifest` param stays for armor normalize only.
