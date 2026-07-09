"use client";

import { useManifest } from "@/lib/manifest/use-manifest";
import type { ProfileItemCounts } from "@/lib/armory/profile-counts";

export interface ArmoryDiagnosticsProps {
  linkedDestinyProfile: boolean;
  characterCount: number;
  normalizedArmor: number;
  rawItems?: ProfileItemCounts;
  loadError?: string;
}

/**
 * Support-safe armory diagnostics: counts only, no membership IDs or item details.
 * Shown when gear looks empty or when `?debug` is in the URL.
 */
export function ArmoryDiagnostics({
  linkedDestinyProfile,
  characterCount,
  normalizedArmor,
  rawItems,
  loadError,
}: ArmoryDiagnosticsProps) {
  const manifestStatus = useManifest();

  const manifestLine =
    manifestStatus.state === "ready"
      ? `ready (${manifestStatus.manifest.version})`
      : manifestStatus.state === "loading"
        ? "loading…"
        : manifestStatus.state === "error"
          ? `error: ${manifestStatus.message}`
          : "idle";

  return (
    <div className="border-border/60 bg-muted/30 space-y-1 rounded-lg border px-3 py-2 text-xs">
      <p className="text-muted-foreground font-medium">Diagnostics</p>
      <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt>Linked Destiny profile</dt>
        <dd className="text-foreground tabular-nums">
          {linkedDestinyProfile ? "yes" : "no"}
        </dd>
        <dt>Characters from Bungie</dt>
        <dd className="text-foreground tabular-nums">{characterCount}</dd>
        {rawItems && (
          <>
            <dt>Raw items (equip / inv / vault)</dt>
            <dd className="text-foreground tabular-nums">
              {rawItems.equipped} / {rawItems.inventory} / {rawItems.vault}
            </dd>
          </>
        )}
        <dt>Normalized armor</dt>
        <dd className="text-foreground tabular-nums">{normalizedArmor}</dd>
        <dt>Manifest</dt>
        <dd className="text-foreground">{manifestLine}</dd>
        {loadError && (
          <>
            <dt>Load error</dt>
            <dd className="text-destructive">{loadError}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
