"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { ArmorPiece } from "@/lib/armory/normalize";
import type { ArmoryCharacter } from "@/lib/armory/fetch";
import { CLASS_NAMES } from "@/lib/armory/stats";
import { Button } from "@/components/ui/button";

type Action = "move" | "equip";

/** Per-item outcome from POST /api/bungie/equip. */
interface EquipResult {
  itemInstanceId: string;
  ok: boolean;
  message?: string;
}

/** The most recently played character matching the piece's class. */
export function targetCharacterFor(
  piece: ArmorPiece,
  characters: ArmoryCharacter[],
): ArmoryCharacter | undefined {
  return characters
    .filter((c) => c.classType === piece.classType)
    .sort(
      (a, b) => Date.parse(b.dateLastPlayed) - Date.parse(a.dateLastPlayed),
    )[0];
}

function moveDisabledReason(
  piece: ArmorPiece,
  target: ArmoryCharacter | undefined,
): string | null {
  if (!target) return `No ${CLASS_NAMES[piece.classType] ?? "matching"} character`;
  if (piece.location === "equipped")
    return "Equipped items can't be moved — equip something else first";
  if (piece.location === "inventory" && piece.characterId === target.id)
    return "Already on that character";
  return null;
}

function equipDisabledReason(
  piece: ArmorPiece,
  target: ArmoryCharacter | undefined,
): string | null {
  if (!target) return `No ${CLASS_NAMES[piece.classType] ?? "matching"} character`;
  if (piece.location === "equipped") {
    return piece.characterId === target.id
      ? "Already equipped"
      : "Equipped on another character — equip something else on them first";
  }
  return null;
}

/**
 * Move / Equip a single piece onto its class's most recently played character,
 * via the same /api/bungie/equip proxy the builder's "Equip items" uses
 * (mode: "move" skips the equip step).
 */
export function ArmorRowActions({
  piece,
  characters,
  onDone,
}: {
  piece: ArmorPiece;
  characters: ArmoryCharacter[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<Action | null>(null);

  const target = targetCharacterFor(piece, characters);
  const reasons: Record<Action, string | null> = {
    move: moveDisabledReason(piece, target),
    equip: equipDisabledReason(piece, target),
  };

  const run = async (action: Action) => {
    if (!target || busy) return;
    setBusy(action);
    try {
      const res = await fetch("/api/bungie/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: target.id,
          mode: action,
          items: [
            {
              itemInstanceId: piece.instanceId,
              itemHash: piece.itemHash,
              location: piece.location,
              characterId: piece.characterId,
            },
          ],
        }),
      });
      const data = (await res.json()) as {
        results?: EquipResult[];
        error?: string;
        reauth?: boolean;
      };

      if (!res.ok) {
        toast.error(data.error ?? `${action === "move" ? "Move" : "Equip"} failed`);
        // The server cleared the stale (pre-scope or expired) session; surfacing
        // the session query brings back the sign-in card.
        if (data.reauth) {
          void queryClient.invalidateQueries({ queryKey: ["session"] });
        }
        return;
      }

      const result = data.results?.[0];
      const className = CLASS_NAMES[piece.classType] ?? "character";
      if (result?.ok) {
        toast.success(
          action === "move"
            ? `Moved ${piece.name} to your ${className}`
            : `Equipped ${piece.name} on your ${className}`,
        );
        onDone();
      } else {
        toast.error(`${piece.name}: ${result?.message ?? "action failed"}`);
      }
    } catch {
      toast.error("Request failed — check your connection and try again");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {(["move", "equip"] as const).map((action) => (
        <Button
          key={action}
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs"
          disabled={Boolean(reasons[action]) || busy !== null}
          title={reasons[action] ?? undefined}
          onClick={() => void run(action)}
        >
          {busy === action && (
            <CircleNotch className="animate-spin" aria-hidden />
          )}
          {action === "move" ? "Move" : "Equip"}
        </Button>
      ))}
    </div>
  );
}
