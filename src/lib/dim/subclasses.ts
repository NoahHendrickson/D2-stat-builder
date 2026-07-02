import type { Subclass } from "../armory/fragments";

/**
 * Subclass ITEM hashes per (subclass, classType 0 Titan | 1 Hunter | 2 Warlock).
 *
 * Hardcoded because the cached manifest deliberately drops subclass defs
 * (itemType 16 — see filterInventoryItems in src/lib/manifest/load.ts); keeping
 * them would force a full manifest re-download for a static 18-row table.
 * Subclass item hashes have been stable since their 3.0 reworks.
 * All 18 verified against manifest 244164.26.06.16.2053-2-bnet.65465
 * (itemType 16 + matching classType).
 */
export const SUBCLASS_ITEM_HASHES: Record<Subclass, Record<number, number>> = {
  Arc: {
    0: 2932390016, // Striker
    1: 2328211300, // Arcstrider
    2: 3168997075, // Stormcaller
  },
  Solar: {
    0: 2550323932, // Sunbreaker
    1: 2240888816, // Gunslinger
    2: 3941205951, // Dawnblade
  },
  Void: {
    0: 2842471112, // Sentinel
    1: 2453351420, // Nightstalker
    2: 2849050827, // Voidwalker
  },
  Stasis: {
    0: 613647804, // Behemoth
    1: 873720784, // Revenant
    2: 3291545503, // Shadebinder
  },
  Strand: {
    0: 242419885, // Berserker
    1: 3785442599, // Threadrunner
    2: 4204413574, // Broodweaver
  },
  Prismatic: {
    0: 1616346845, // Prismatic Titan
    1: 4282591831, // Prismatic Hunter
    2: 3893112950, // Prismatic Warlock
  },
};

/**
 * First fragment socket index on a subclass item, used for the DIM handoff's
 * socketOverrides. Verified against the live manifest's socketEntries: every
 * non-Prismatic subclass has fragments at sockets 7–12; Prismatic puts
 * transcendence + grenade at 5–6 and aspects at 7–8, pushing fragments to 9–14.
 * A wrong index degrades to "fragment ignored" in DIM, never an error.
 */
export const FRAGMENT_SOCKET_START: Record<Subclass, number> = {
  Arc: 7,
  Solar: 7,
  Void: 7,
  Stasis: 7,
  Strand: 7,
  Prismatic: 9,
};
