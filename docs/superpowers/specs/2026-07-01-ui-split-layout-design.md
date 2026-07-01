# Stat Builder — split-view UI layout

Date: 2026-07-01
Status: Approved (mockup reviewed and approved)

## Goal

Reorganize the builder from a single centered column into a two-column split:
left = configuration, right = generated builds. Pure frontend change — no
optimizer or data-model changes.

## Layout

Responsive two-column grid. Desktop: two columns side by side. Narrow screens:
stacks (all left blocks, then the builds list).

### Left column (top → bottom)

1. **Class selector** — segmented control (Tabs). The first thing the user picks.
   Shown only when the account has more than one class.
2. **Stat targets** — the six Armor 3.0 sliders. Unchanged behavior.
3. **Mod budget** — segmented `0–5` picker (replaces the old slider). Value = number
   of major (+10) mods; the remaining `5 − N` are minor (+5).
4. **Exotic** — clickable thumbnail grid (new component). Click a thumbnail to require
   that exotic, click again to clear. Nothing selected = optimizer decides. The old
   `none` / `require-any` dropdown modes are removed from the UI.
5. **Set bonuses** — unchanged block (2pc / 4pc toggles).
6. **Fragments** — placeholder ("coming soon"). No logic yet.
7. **Tier-5 tuning** — toggle. Unchanged behavior.
8. **Status cards** — SignInCard, ManifestStatus, ArmoryStatus, PieceInspector,
   dimmed, at the bottom. Kept here "for now"; slated to be hidden later.

### Right column

- Header row: "Builds" title + "Find builds" button (moved here from the bottom of
  the form so the action sits with its output).
- Result count + builds list (the existing `Results` component). Empty state before
  the first run; a sign-in prompt when not yet ready.

## Confirmed decisions

- Find-builds button lives at the **top of the right column**.
- Mod budget segments are **0–5** (0 major = all five minor).
- Exotic picker is **grid only** — any (nothing selected) or specific (one selected).

## Technical approach

- `next.config.ts`: add `images.remotePatterns` for `www.bungie.net` (`/common/**`) so
  exotic icons load through `next/image`.
- `src/lib/bungie/constants.ts`: add `BUNGIE_IMAGE_BASE`.
- `src/components/builder/exotic-picker.tsx` (new): the thumbnail grid. Icons come from
  the `icon` already stored on each `ArmorPiece`, prefixed with `BUNGIE_IMAGE_BASE`.
- `src/components/builder/builder-panel.tsx`: becomes the two-column container. Keeps all
  existing state + the optimizer call. Renders the left config blocks + the right builds
  list, and hosts the status cards at the bottom of the left column. The old early
  `return null` is removed: config blocks are gated on "ready" (authenticated + armory +
  manifest), the status cards always render, and the right column shows an empty/sign-in
  state until a run completes. The `exotics` memo now also carries each exotic's `icon`,
  and the exotic constraint collapses to `any` | `specific`.
- `src/app/page.tsx`: slims to a header + `<BuilderPanel />`, widened container.

## Out of scope

- Optimizer logic, fragment stat logic, actually hiding the status cards, and any visual
  redesign beyond this layout.
