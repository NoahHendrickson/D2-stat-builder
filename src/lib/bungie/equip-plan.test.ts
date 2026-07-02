import { test, expect } from "vitest";
import { planTransfers, type EquipItemState } from "./equip-plan";

const TARGET = "char-A";

function item(over: Partial<EquipItemState>): EquipItemState {
  return { itemInstanceId: "i1", itemHash: 111, location: "vault", ...over };
}

test("piece already on the target character needs no transfer", () => {
  expect(
    planTransfers(
      [
        item({ location: "inventory", characterId: TARGET }),
        item({ location: "equipped", characterId: TARGET }),
      ],
      TARGET,
    ),
  ).toEqual([]);
});

test("vault piece takes one hop to the target", () => {
  expect(planTransfers([item({ itemInstanceId: "v1", itemHash: 42 })], TARGET)).toEqual([
    { itemId: "v1", itemReferenceHash: 42, transferToVault: false, characterId: TARGET },
  ]);
});

test("piece on another character takes two hops through the vault", () => {
  expect(
    planTransfers(
      [item({ itemInstanceId: "o1", itemHash: 7, location: "inventory", characterId: "char-B" })],
      TARGET,
    ),
  ).toEqual([
    { itemId: "o1", itemReferenceHash: 7, transferToVault: true, characterId: "char-B" },
    { itemId: "o1", itemReferenceHash: 7, transferToVault: false, characterId: TARGET },
  ]);
});

test("mixed set plans each piece independently, in order", () => {
  const actions = planTransfers(
    [
      item({ itemInstanceId: "a", characterId: undefined }), // vault
      item({ itemInstanceId: "b", location: "equipped", characterId: TARGET }), // no-op
      item({ itemInstanceId: "c", location: "inventory", characterId: "char-B" }), // 2 hops
    ],
    TARGET,
  );
  expect(actions.map((a) => [a.itemId, a.transferToVault])).toEqual([
    ["a", false],
    ["c", true],
    ["c", false],
  ]);
});
