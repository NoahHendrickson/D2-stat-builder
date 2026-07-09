import { test, expect } from "vitest";
import type { Manifest } from "@/lib/manifest/load";
import { STAT_HASHES } from "./stats";
import {
  EXOTIC_CLASS_ITEM_HASHES,
  RIGHT_SPIRIT_PREFERRED_TERTIARY,
  archetypePlugForStats,
  matchesSpiritSelection,
  resolveTertiary,
  synthesizeClassItemBaseStats,
  synthesizeClassItemStats,
} from "./exotic-class-perks";

const H = STAT_HASHES;

/** Inmost Light — Paragon: Super 30 / Melee 25 (live manifest). */
const INMOST = 1476923953;
/** Cyrtarachne — preferred tertiary Grenade (verified). */
const CYRTARACHNE = 3751917994;
/** Synthoceps — preferred tertiary Melee (collides with Inmost secondary). */
const SYNTHOCEPS = 1476923956;

function mockManifest(
  plugs: Record<
    number,
    {
      investmentStats?: {
        statTypeHash: number;
        value: number;
        isConditionallyActive?: boolean;
      }[];
      displayProperties?: { name?: string; icon?: string };
      classType?: number;
      plug?: { plugCategoryIdentifier?: string };
    }
  >,
): Manifest {
  return {
    def: (_table: string, hash: number | null | undefined) =>
      hash == null ? undefined : plugs[hash],
    all: () => plugs,
  } as unknown as Manifest;
}

test("resolveTertiary keeps preferred when it doesn't collide", () => {
  // Paragon primary=super(4), secondary=melee(5); Cyrtarachne prefers grenade(3).
  expect(resolveTertiary(3, 4, 5)).toBe(3);
});

test("resolveTertiary remaps when preferred collides with archetype", () => {
  // Preferred melee(5) collides with secondary → first free in STAT_ORDER = weapons(0).
  expect(resolveTertiary(5, 4, 5)).toBe(0);
});

test("synthesizeClassItemBaseStats builds 30/25/20 from left+right Spirits", () => {
  const manifest = mockManifest({
    [INMOST]: {
      investmentStats: [
        { statTypeHash: H.super, value: 30 },
        { statTypeHash: H.melee, value: 25 },
      ],
    },
  });
  // STAT_ORDER: weapons, health, class, grenade, super, melee
  expect(synthesizeClassItemBaseStats(manifest, INMOST, CYRTARACHNE)).toEqual([
    0, 0, 0, 20, 30, 25,
  ]);
});

test("synthesizeClassItemStats applies MW5 to the three off-archetype stats", () => {
  const manifest = mockManifest({
    [INMOST]: {
      investmentStats: [
        { statTypeHash: H.super, value: 30 },
        { statTypeHash: H.melee, value: 25 },
      ],
    },
  });
  // Off-arch: weapons, health, class → 5; grenade tertiary stays 20; super/melee capped.
  expect(synthesizeClassItemStats(manifest, INMOST, CYRTARACHNE)).toEqual([
    5, 5, 5, 20, 30, 25,
  ]);
});

test("synthesize remaps tertiary when preferred collides (Inmost + Synthoceps)", () => {
  const manifest = mockManifest({
    [INMOST]: {
      investmentStats: [
        { statTypeHash: H.super, value: 30 },
        { statTypeHash: H.melee, value: 25 },
      ],
    },
  });
  expect(RIGHT_SPIRIT_PREFERRED_TERTIARY[SYNTHOCEPS]).toBe(5); // melee
  // Remap to weapons(0) → base [20, 0, 0, 0, 30, 25]
  expect(synthesizeClassItemBaseStats(manifest, INMOST, SYNTHOCEPS)).toEqual([
    20, 0, 0, 0, 30, 25,
  ]);
});

test("synthesize returns null when left Spirit has no archetype stats", () => {
  const manifest = mockManifest({ [INMOST]: { investmentStats: [] } });
  expect(synthesizeClassItemBaseStats(manifest, INMOST, CYRTARACHNE)).toBeNull();
});

test("archetypePlugForStats resolves Paragon for Super/Melee", () => {
  const PARAGON = 4227065942;
  const manifest = mockManifest({
    [PARAGON]: {
      plug: { plugCategoryIdentifier: "armor_archetypes" },
      displayProperties: {
        name: "Paragon",
        icon: "/common/destiny2_content/icons/paragon.png",
      },
    },
  });
  // STAT_ORDER: weapons=0 health=1 class=2 grenade=3 super=4 melee=5
  expect(archetypePlugForStats(manifest, 4, 5)).toEqual({
    name: "Paragon",
    icon: "/common/destiny2_content/icons/paragon.png",
  });
});

test("matchesSpiritSelection treats null as Any", () => {
  expect(matchesSpiritSelection([INMOST, CYRTARACHNE], [null, null])).toBe(true);
  expect(matchesSpiritSelection([INMOST, CYRTARACHNE], [INMOST, null])).toBe(true);
  expect(matchesSpiritSelection([INMOST, CYRTARACHNE], [null, CYRTARACHNE])).toBe(
    true,
  );
  expect(matchesSpiritSelection([INMOST, CYRTARACHNE], [INMOST, SYNTHOCEPS])).toBe(
    false,
  );
  expect(matchesSpiritSelection(undefined, [INMOST, null])).toBe(false);
});

test("exotic class item hashes cover all three classes", () => {
  expect(Object.keys(EXOTIC_CLASS_ITEM_HASHES)).toHaveLength(3);
});
