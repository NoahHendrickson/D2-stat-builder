import { NextResponse } from "next/server";
import { equipItems, transferItem } from "bungie-api-ts/destiny2";
import { BungieHttpError, createBungieHttp } from "@/lib/bungie/http";
import {
  clearSession,
  getValidAccessToken,
  readUser,
} from "@/lib/bungie/session";
import { planTransfers, type EquipItemState } from "@/lib/bungie/equip-plan";

export const dynamic = "force-dynamic";

/** Bungie asks for ≥100ms between item actions; stay comfortably above it. */
const ACTION_SPACING_MS = 150;

/** Friendly text for the PlatformErrorCodes an equip realistically returns. */
const EQUIP_MESSAGES: Record<number, string> = {
  1623: "Item not found — your inventory may be stale, refresh your gear",
  1640: "That item can't be equipped right now",
  1641: "Only one exotic can be equipped at a time",
  1642: "No room on that character — free up inventory space",
  1671: "Can't equip during an activity — go to orbit or a social space",
};

const SUCCESS = 1;

interface EquipRequestBody {
  characterId: string;
  items: EquipItemState[];
  /** "move" stages the items on the character without equipping. Default "equip". */
  mode?: "move" | "equip";
}

interface ItemResult {
  itemInstanceId: string;
  ok: boolean;
  message?: string;
}

function parseBody(body: unknown): EquipRequestBody | null {
  const b = body as Partial<EquipRequestBody> | null;
  if (
    !b ||
    typeof b.characterId !== "string" ||
    !b.characterId ||
    !Array.isArray(b.items) ||
    b.items.length === 0 ||
    b.items.length > 5 ||
    b.items.some(
      (i) =>
        typeof i?.itemInstanceId !== "string" ||
        !i.itemInstanceId ||
        typeof i.itemHash !== "number" ||
        (i.characterId !== undefined && typeof i.characterId !== "string"),
    ) ||
    (b.mode !== undefined && b.mode !== "move" && b.mode !== "equip")
  ) {
    return null;
  }
  return b as EquipRequestBody;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Equipped items can't be transferred — give that case a clear message up front. */
function transferBlockReason(item: EquipItemState, targetId: string): string | null {
  if (item.location === "equipped" && item.characterId !== targetId) {
    return "Equipped on another character — equip something else on them first";
  }
  return null;
}

export async function POST(request: Request) {
  const user = await readUser();
  const token = await getValidAccessToken();
  if (!user?.destinyMembershipId || user.destinyMembershipType == null || !token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: EquipRequestBody | null = null;
  try {
    body = parseBody(await request.json());
  } catch {
    body = null;
  }
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { characterId, items } = body;
  const membershipType = user.destinyMembershipType;
  const http = createBungieHttp(token);

  const failed = new Map<string, string>();
  for (const item of items) {
    const reason = transferBlockReason(item, characterId);
    if (reason) failed.set(item.itemInstanceId, reason);
  }

  try {
    // Stage every piece on the target character (sequential — Bungie rate limit).
    const actions = planTransfers(
      items.filter((i) => !failed.has(i.itemInstanceId)),
      characterId,
    );
    for (const action of actions) {
      if (failed.has(action.itemId)) continue; // earlier hop failed
      try {
        await transferItem(http, {
          itemReferenceHash: action.itemReferenceHash,
          stackSize: 1,
          transferToVault: action.transferToVault,
          itemId: action.itemId,
          characterId: action.characterId,
          membershipType,
        });
      } catch (err) {
        if (err instanceof BungieHttpError && err.status === 401) throw err;
        failed.set(
          action.itemId,
          err instanceof Error ? err.message : "Transfer failed",
        );
      }
      await sleep(ACTION_SPACING_MS);
    }

    const stagedIds = items
      .map((i) => i.itemInstanceId)
      .filter((id) => !failed.has(id));
    const results: ItemResult[] = [];
    if (body.mode === "move") {
      // Move-only: transfers are the whole job — staged items succeeded.
      for (const id of stagedIds) {
        results.push({ itemInstanceId: id, ok: true });
      }
    } else if (stagedIds.length > 0) {
      // Batch-equip whatever made it onto the character.
      const res = await equipItems(http, {
        itemIds: stagedIds,
        characterId,
        membershipType,
      });
      for (const r of res.Response.equipResults ?? []) {
        results.push({
          itemInstanceId: r.itemInstanceId,
          ok: r.equipStatus === SUCCESS,
          message:
            r.equipStatus === SUCCESS
              ? undefined
              : (EQUIP_MESSAGES[r.equipStatus] ??
                `Equip failed (code ${r.equipStatus})`),
        });
      }
    }
    for (const [itemInstanceId, message] of failed) {
      results.push({ itemInstanceId, ok: false, message });
    }

    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof BungieHttpError && err.status === 401) {
      // Pre-scope tokens (or an expired session) get a 401 from Bungie — the fix
      // is a fresh sign-in that carries the move/equip scope.
      await clearSession();
      return NextResponse.json(
        {
          error: "Bungie needs new permissions — sign in again to allow equipping",
          reauth: true,
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bungie request failed" },
      { status: 502 },
    );
  }
}
