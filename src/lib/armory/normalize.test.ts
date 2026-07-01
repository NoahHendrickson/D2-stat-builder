import { test, expect } from "vitest";
import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";
import type { Manifest } from "@/lib/manifest/load";
import { computeBaseStats } from "./normalize";
import { STAT_HASHES } from "./stats";

const H = STAT_HASHES;

type Plug = {
  plug: { plugCategoryIdentifier: string };
  investmentStats: { statTypeHash: number; value: number }[];
};

function mkProfile(
  id: string,
  stats: Record<number, number>,
  plugHashes: number[],
): DestinyProfileResponse {
  return {
    itemComponents: {
      stats: {
        data: {
          [id]: {
            stats: Object.fromEntries(
              Object.entries(stats).map(([h, v]) => [h, { value: v }]),
            ),
          },
        },
      },
      sockets: {
        data: { [id]: { sockets: plugHashes.map((plugHash) => ({ plugHash })) } },
      },
    },
  } as unknown as DestinyProfileResponse;
}

function mkManifest(plugs: Record<number, Plug>): Manifest {
  return {
    def: (_table: string, hash: number | null | undefined) =>
      hash == null ? undefined : plugs[hash],
  } as unknown as Manifest;
}

test("Balanced Tuning strips off-archetype stats only, leaving the archetype capped", () => {
  // Archetype weapons/super/grenade = 30/25/20; off-arch health/class/melee = 6 (5 MW + 1 balanced).
  const cur = {
    [H.weapons]: 30,
    [H.health]: 6,
    [H.class]: 6,
    [H.grenade]: 20,
    [H.super]: 25,
    [H.melee]: 6,
  };
  const BAL = 111;
  const manifest = mkManifest({
    [BAL]: {
      plug: { plugCategoryIdentifier: "armor_tuning_balanced" },
      // Manifest lie: Balanced Tuning lists +1 to all six stats.
      investmentStats: Object.values(H).map((statTypeHash) => ({
        statTypeHash,
        value: 1,
      })),
    },
  });
  // STAT_ORDER [weapons, health, class, grenade, super, melee]. Archetype must stay 30/25/20.
  expect(computeBaseStats("bond", mkProfile("bond", cur, [BAL]), manifest)).toEqual([
    30, 5, 5, 20, 25, 5,
  ]);
});

test("a directional tune (with a −5) is reversed in full on the stats it names", () => {
  // Current reflects a +5 weapons / −5 health directional over base [25, 10, 5, 20, 25, 5].
  const cur = {
    [H.weapons]: 30,
    [H.health]: 5,
    [H.class]: 5,
    [H.grenade]: 20,
    [H.super]: 25,
    [H.melee]: 5,
  };
  const DIR = 222;
  const manifest = mkManifest({
    [DIR]: {
      plug: { plugCategoryIdentifier: "armor_tuning" },
      investmentStats: [
        { statTypeHash: H.weapons, value: 5 },
        { statTypeHash: H.health, value: -5 },
      ],
    },
  });
  expect(computeBaseStats("x", mkProfile("x", cur, [DIR]), manifest)).toEqual([
    25, 10, 5, 20, 25, 5,
  ]);
});
