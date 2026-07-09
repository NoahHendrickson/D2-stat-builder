import { describe, expect, it } from "vitest";
import { countProfileItems } from "./profile-counts";

describe("countProfileItems", () => {
  it("sums items across equipment, inventories, and vault", () => {
    expect(
      countProfileItems({
        characterEquipment: {
          data: {
            char1: { items: [{ itemHash: 1 }, { itemHash: 2 }] },
          },
        },
        characterInventories: {
          data: {
            char1: { items: [{ itemHash: 3 }] },
            char2: { items: [] },
          },
        },
        profileInventory: {
          data: { items: [{ itemHash: 4 }, { itemHash: 5 }, { itemHash: 6 }] },
        },
      }),
    ).toEqual({ equipped: 2, inventory: 1, vault: 3 });
  });

  it("handles missing profile sections", () => {
    expect(countProfileItems({})).toEqual({ equipped: 0, inventory: 0, vault: 0 });
  });
});
