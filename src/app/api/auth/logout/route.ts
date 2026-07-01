import { NextResponse } from "next/server";
import { clearSession } from "@/lib/bungie/session";
import { APP_URL } from "@/lib/bungie/constants";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  await clearSession();
  return NextResponse.redirect(`${APP_URL}/`);
}
