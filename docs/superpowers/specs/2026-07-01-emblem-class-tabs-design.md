# Emblem class tabs — design

- **Date:** 2026-07-01
- **Status:** Approved (design)
- **Area:** `src/components/builder`, `src/lib/armory`

## Goal

Replace the plain text class tabs (Hunter / Warlock / Titan) in the builder with
**emblem nameplates** pulled from the player's own characters — each tab shows that
class's equipped emblem art, with the class name and Power level overlaid. It still
reads "Hunter / Warlock / Titan"; it just looks like an in-game Destiny nameplate.

## Context (what exists today)

- The class selector is an inline shadcn `Tabs`/`TabsList`/`TabsTrigger` block in
  [builder-panel.tsx:264](../../../src/components/builder/builder-panel.tsx) — one
  trigger per class, labeled with `CLASS_NAMES[c]`, valued by `classType`.
- The profile proxy already fetches component `200` (Characters):
  [profile/route.ts](../../../src/app/api/bungie/profile/route.ts). That component
  carries `emblemPath`, `emblemBackgroundPath`, `emblemHash`, and `emblemColor` per
  character.
- We currently **discard** those fields — [fetch.ts:26](../../../src/lib/armory/fetch.ts)
  maps each character down to `{ id, classType, light }`.
- All Bungie images render via `next/image` with `` `${BUNGIE_IMAGE_BASE}${path}` ``
  (`BUNGIE_IMAGE_BASE = "https://www.bungie.net"`). `next.config.ts` already allow-lists
  `www.bungie.net/common/**`, which is where emblem paths live — no config change needed.

So this is mostly a **display change**: no new API calls, no new auth, no manifest work.

## Design

### Layout

Three nameplates in a row, inside the existing **Class** section:

```
┌───────────┐ ┌───────────┐ ┌───────────┐
│ ▓emblem▓  │ │  emblem   │ │  emblem   │
│ TITAN     │ │ HUNTER    │ │ WARLOCK   │
│ ✦ 2010    │ │ ✦ 2008    │ │ ✦ 2010    │
└━━━━━━━━━━━┘ └───────────┘ └───────────┘
  ▲ active                    inactive
  bright ring, full color     full color, slightly dimmed
```

- One tab **per class**, not per character (matches how the optimizer filters armor by
  `classType`).
- Class order follows the profile's character order (Bungie returns characters
  most-recently-played first) — unchanged from today's `Set`-based derivation.

### 1. Data — `src/lib/armory/fetch.ts`

Surface the emblem fields we already receive. Extend `ArmoryCharacter`:

```ts
export interface ArmoryCharacter {
  id: string;
  classType: number;
  light: number;
  emblemBackgroundPath: string;      // wide nameplate banner, relative /common/... path
  emblemColor?: DestinyColor;        // { red, green, blue, alpha } 0–255 — fallback fill
  dateLastPlayed: string;            // ISO; picks the emblem when a class has 2+ characters
}
```

Add those three fields to the existing `.map()` over `profile.characters.data`. No other
changes to the fetch/normalize pipeline.

### 2. New component — `src/components/builder/class-emblem-tabs.tsx`

A focused, presentational component. Built **on top of** the existing shadcn
`Tabs`/`TabsList`/`TabsTrigger` primitives (custom className + children) so roving
tabindex, arrow-key navigation, and aria roles come for free.

**Props:**

```ts
interface ClassEmblemTabsProps {
  characters: ArmoryCharacter[];   // all characters; component groups by class itself
  value: number;                   // selected classType
  onChange: (classType: number) => void;
}
```

**Responsibilities:**

- Group `characters` by `classType`, filter to valid classes (`CLASS_NAMES[c] !== undefined`),
  and pick the **most-recently-played** character per class (max `dateLastPlayed`) as that
  tab's emblem.
- Render each class as a banner: a `next/image` of `` `${BUNGIE_IMAGE_BASE}${emblemBackgroundPath}` ``
  (`object-cover`, left-anchored so the emblem's icon edge stays visible — final crop tuned
  during the visual check), with `CLASS_NAMES[c]` uppercase + `✦ {light}` overlaid.
- A bottom-anchored gradient scrim (`bg-gradient-to-t from-black/70 to-transparent`) sits
  behind the text so it stays legible over any emblem art.
- Row layout: `grid grid-cols-3 gap-2`; banners ~`h-14`.

### 3. Selected / unselected states (Option B)

- **All three** emblems stay full color.
- **Inactive:** slightly dimmed (`opacity-80`).
- **Active:** full opacity + a bright `ring-2` accent ring (app `ring`/primary accent, **not**
  `emblemColor` — a fixed accent guarantees contrast against every emblem) + a slight shadow.

### 4. Fallback

If `emblemBackgroundPath` is missing, or the `next/image` fails to load (`onError`), render
the same banner shape as a **solid `emblemColor` fill** (or a neutral background if no color)
with the class name + Power. Layout dimensions are identical, so the row never shifts.

### 5. Wiring — `src/components/builder/builder-panel.tsx`

Replace the inline `Tabs` block ([builder-panel.tsx:264](../../../src/components/builder/builder-panel.tsx))
with:

```tsx
<ClassEmblemTabs
  characters={armory.characters}
  value={classType}
  onChange={onClassChange}
/>
```

- `onClassChange` already takes a `classType` number, so the optimizer selection model is
  untouched.
- The existing `classes.length > 1` guard around the **Class** section stays in
  `builder-panel.tsx`, so a player with only one class sees no selector at all — unchanged
  from today. The new component therefore only ever renders when 2+ classes exist.

## Decisions / edge cases

- **Two characters of the same class** → show the most-recently-played one's emblem
  (`dateLastPlayed`). Single tab per class regardless.
- **Active ring color** → fixed app accent, not `emblemColor`, for guaranteed contrast.
- **`emblemColor`** → used only as the fallback fill, not the ring.
- **Image crop** → `object-cover` left-anchored; exact object-position tuned against the real
  emblems during the visual check.

## Out of scope (YAGNI)

- Per-character tabs / a character switcher (we select by class, not character).
- Showing the emblem anywhere else (results panel, header, etc.).
- Emblem/title/seasonal-rank text beyond class name + Power.
- Animations beyond the ring/opacity state change.

## Verification

- `tsc` / `next build` clean (no type or build errors).
- Visual check in the running app: emblems load for each class, the active ring reads clearly,
  text stays legible over busy emblem art, switching classes still filters armor correctly, and
  the fallback renders when an image is forced to fail.
