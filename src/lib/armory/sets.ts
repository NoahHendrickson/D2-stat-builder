import type { Manifest } from "@/lib/manifest/load";
import type { ArmorPiece } from "./normalize";

export interface SetPerkInfo {
  requiredCount: number;
  name: string;
  description?: string;
}

export interface ArmorSetInfo {
  setHash: number;
  name: string;
  perks: SetPerkInfo[];
  /** How many pieces of this set the player owns (within the given list). */
  ownedCount: number;
}

/** Resolve the distinct armor sets present in `pieces` to names + 2pc/4pc perks. */
export function availableSets(
  pieces: ArmorPiece[],
  manifest: Manifest,
): ArmorSetInfo[] {
  const counts = new Map<number, number>();
  for (const p of pieces) {
    if (p.setHash) counts.set(p.setHash, (counts.get(p.setHash) ?? 0) + 1);
  }

  const sets: ArmorSetInfo[] = [];
  for (const [setHash, ownedCount] of counts) {
    const def = manifest.def("DestinyEquipableItemSetDefinition", setHash);
    if (!def) continue;
    const perks: SetPerkInfo[] = (def.setPerks ?? [])
      .map((sp) => {
        const perk = manifest.def(
          "DestinySandboxPerkDefinition",
          sp.sandboxPerkHash,
        );
        return {
          requiredCount: sp.requiredSetCount,
          name:
            perk?.displayProperties?.name ?? `${sp.requiredSetCount}-piece bonus`,
          description: perk?.displayProperties?.description || undefined,
        };
      })
      .sort((a, b) => a.requiredCount - b.requiredCount);

    sets.push({
      setHash,
      name: def.displayProperties?.name ?? "Unknown set",
      perks,
      ownedCount,
    });
  }

  return sets.sort((a, b) => b.ownedCount - a.ownedCount);
}
