"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { BUNGIE_IMAGE_BASE } from "@/lib/bungie/constants";

export interface ExoticOption {
  name: string;
  /** All item hashes for this exotic (same exotic can exist as Armor 2.0 + 3.0). */
  hashes: number[];
  /** Relative Bungie icon path, if any. */
  icon?: string;
}

/**
 * Thumbnail grid for choosing which exotic to build around. Click a tile to require
 * that exotic, click it again to clear. Nothing selected = the optimizer decides.
 */
export function ExoticPicker({
  options,
  selected,
  onSelect,
}: {
  options: ExoticOption[];
  selected: number | null;
  onSelect: (index: number | null) => void;
}) {
  if (options.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        No exotic armor found for this class.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((exotic, index) => {
          const active = selected === index;
          return (
            <button
              key={exotic.name}
              type="button"
              title={exotic.name}
              aria-label={exotic.name}
              aria-pressed={active}
              onClick={() => onSelect(active ? null : index)}
              className={cn(
                "relative size-11 overflow-hidden rounded-md border transition-colors",
                active
                  ? "border-primary ring-primary ring-2"
                  : "border-border/60 hover:border-border",
              )}
            >
              {exotic.icon ? (
                <Image
                  src={`${BUNGIE_IMAGE_BASE}${exotic.icon}`}
                  alt={exotic.name}
                  width={44}
                  height={44}
                  className="size-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-muted-foreground flex size-full items-center justify-center text-xs">
                  {exotic.name.slice(0, 2)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        {selected === null ? (
          "Any exotic — the optimizer decides. Click one to require it."
        ) : (
          <>
            Requiring{" "}
            <span className="text-foreground">{options[selected]?.name}</span>.{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => onSelect(null)}
            >
              Clear
            </button>
          </>
        )}
      </p>
    </div>
  );
}
