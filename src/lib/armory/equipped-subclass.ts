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
