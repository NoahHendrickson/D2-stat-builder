import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";

/** Aggregate Bungie item counts before normalization — safe to show for support. */
export interface ProfileItemCounts {
  equipped: number;
  inventory: number;
  vault: number;
}

function countBucketItems(
  buckets: Record<string, { items?: unknown[] }> | undefined,
): number {
  let total = 0;
  for (const bucket of Object.values(buckets ?? {})) {
    total += bucket.items?.length ?? 0;
  }
  return total;
}

/** Count all items Bungie returned across equipment, character inventories, and vault. */
export function countProfileItems(profile: DestinyProfileResponse): ProfileItemCounts {
  return {
    equipped: countBucketItems(profile.characterEquipment?.data),
    inventory: countBucketItems(profile.characterInventories?.data),
    vault: profile.profileInventory?.data?.items?.length ?? 0,
  };
}
