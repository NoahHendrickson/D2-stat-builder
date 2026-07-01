import type { Manifest } from "@/lib/manifest/load";
import { STAT_HASH_TO_INDEX, type StatArray } from "./stats";

export type Subclass = "Arc" | "Solar" | "Void" | "Stasis" | "Strand" | "Prismatic";

/** Tab order for the fragment picker. */
export const SUBCLASSES: Subclass[] = [
  "Arc",
  "Solar",
  "Void",
  "Stasis",
  "Strand",
  "Prismatic",
];

// Fragment plug category -> subclass. NOTE: Stasis fragments live under
// `shared.stasis.trinkets`, NOT `.fragments` — verified against the live manifest,
// and a naive "fragments" filter silently drops all of Stasis.
const CATEGORY_SUBCLASS: Record<string, Subclass> = {
  "shared.arc.fragments": "Arc",
  "shared.solar.fragments": "Solar",
  "shared.void.fragments": "Void",
  "shared.stasis.trinkets": "Stasis",
  "shared.strand.fragments": "Strand",
  "shared.prism.fragments": "Prismatic",
};

export interface FragmentInfo {
  hash: number;
  name: string;
  icon?: string;
  subclass: Subclass;
  /** Summed investment stats on the six armor stats (STAT_ORDER); may be negative. */
  stats: StatArray;
}

/**
 * Stat-affecting subclass fragments from the manifest, grouped by subclass and sorted by
 * name. Fragments are plug items; this keeps only those in a known fragment category that
 * carry armor-stat investment. Not owned-gated — any fragment is selectable (theoretical
 * builds), matching D2ArmorPicker.
 */
export function availableFragments(
  manifest: Manifest,
): Record<Subclass, FragmentInfo[]> {
  const out: Record<Subclass, FragmentInfo[]> = {
    Arc: [],
    Solar: [],
    Void: [],
    Stasis: [],
    Strand: [],
    Prismatic: [],
  };

  const table = manifest.all("DestinyInventoryItemDefinition");
  for (const key in table) {
    const def = table[key];
    const cat = def.plug?.plugCategoryIdentifier;
    const subclass = cat ? CATEGORY_SUBCLASS[cat] : undefined;
    if (!subclass) continue;

    const stats: StatArray = [0, 0, 0, 0, 0, 0];
    let touches = false;
    for (const inv of def.investmentStats ?? []) {
      const idx = STAT_HASH_TO_INDEX[inv.statTypeHash];
      if (idx !== undefined) {
        stats[idx] += inv.value;
        touches = true;
      }
    }
    if (!touches) continue;

    out[subclass].push({
      hash: Number(key),
      name: def.displayProperties?.name ?? "Unknown",
      icon: def.displayProperties?.icon,
      subclass,
      stats,
    });
  }

  for (const s of SUBCLASSES) out[s].sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
