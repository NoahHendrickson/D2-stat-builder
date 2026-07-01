import { NextResponse } from "next/server";
import { getProfile, type DestinyComponentType } from "bungie-api-ts/destiny2";
import { createBungieHttp } from "@/lib/bungie/http";
import { getValidAccessToken, readUser } from "@/lib/bungie/session";

export const dynamic = "force-dynamic";

// 102 Vault · 200 Characters · 201 CharacterInventories · 205 CharacterEquipment
// 300 ItemInstances · 304 ItemStats · 305 ItemSockets · 310 ItemReusablePlugs
// 310 is needed for tuning: it exposes each Tier-5 piece's available tuning plugs
// (which reveal its rolled "tuned stat"). It 500'd client-side on the full vault;
// re-added here to test whether the server-to-server call handles the larger payload.
const COMPONENTS = [102, 200, 201, 205, 300, 304, 305, 310] as DestinyComponentType[];

/**
 * Server-side proxy for the player's Destiny profile. Runs server-to-server so
 * Bungie's Origin-header check never fires and the access token never leaves the
 * server. Returns the raw DestinyProfileResponse for the client to normalize.
 */
export async function GET() {
  const user = await readUser();
  const token = await getValidAccessToken();
  if (!user?.destinyMembershipId || user.destinyMembershipType == null || !token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const http = createBungieHttp(token);
    const res = await getProfile(http, {
      destinyMembershipId: user.destinyMembershipId,
      membershipType: user.destinyMembershipType,
      components: COMPONENTS,
    });
    return NextResponse.json(res.Response);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bungie request failed" },
      { status: 502 },
    );
  }
}
