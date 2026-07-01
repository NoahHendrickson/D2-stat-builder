import { NextResponse } from "next/server";
import { getValidAccessToken, readUser } from "@/lib/bungie/session";

export const dynamic = "force-dynamic";

/**
 * Reports whether there's a usable session. The access token stays server-side;
 * authenticated Bungie calls go through our own API routes.
 */
export async function GET() {
  const user = await readUser();
  const token = await getValidAccessToken();
  if (!user || !token) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: true, user });
}
