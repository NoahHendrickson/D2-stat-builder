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
