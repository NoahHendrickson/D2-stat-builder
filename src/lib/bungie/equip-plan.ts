import type { ArmorLocation } from "@/lib/armory/normalize";

/** What the client knows about a piece's whereabouts when it asks to equip. */
export interface EquipItemState {
  itemInstanceId: string;
  itemHash: number;
  location: ArmorLocation;
  characterId?: string;
}

/** One TransferItem call: move `itemId` to/from the vault for `characterId`. */
export interface TransferAction {
  itemId: string;
  itemReferenceHash: number;
  transferToVault: boolean;
  characterId: string;
}

/**
 * The ordered TransferItem calls that stage every piece on the target character.
 * Bungie only moves items vault↔character, so: already on the target → nothing;
 * in the vault → one hop; on another character → two hops through the vault.
 *
 * A piece *equipped* on another character can't be transferred at all (Bungie
 * rejects moving equipped items) — planning it anyway lets the per-item error
 * from Bungie surface with a clear message rather than silently skipping.
 */
export function planTransfers(
  items: EquipItemState[],
  targetCharacterId: string,
): TransferAction[] {
  const actions: TransferAction[] = [];
  for (const item of items) {
    if (item.characterId === targetCharacterId) continue;
    const base = { itemId: item.itemInstanceId, itemReferenceHash: item.itemHash };
    if (item.location !== "vault" && item.characterId) {
      actions.push({ ...base, transferToVault: true, characterId: item.characterId });
    }
    actions.push({ ...base, transferToVault: false, characterId: targetCharacterId });
  }
  return actions;
}
