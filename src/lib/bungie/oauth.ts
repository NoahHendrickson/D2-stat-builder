import { BUNGIE_AUTHORIZE_URL, BUNGIE_TOKEN_URL } from "./constants";

/**
 * Server-side Bungie OAuth (Confidential client). The client secret lives only
 * here and never reaches the browser. Do not import this module from client code.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}. See .env.example.`);
  return value;
}

const clientId = () => requireEnv("BUNGIE_CLIENT_ID");
const clientSecret = () => requireEnv("BUNGIE_CLIENT_SECRET");

export interface BungieTokens {
  accessToken: string;
  accessExpiresAt: number; // epoch ms
  refreshToken: string;
  refreshExpiresAt: number; // epoch ms
  membershipId: string; // bungie.net membership id
}

interface RawTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  membership_id: string;
}

/** Build the Bungie authorize URL the browser is redirected to. */
export function buildAuthorizeUrl(state: string): string {
  const url = new URL(BUNGIE_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  // Bungie uses the single redirect URL registered in the portal — don't send one.
  return url.toString();
}

async function requestToken(body: Record<string, string>): Promise<BungieTokens> {
  const basic = Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64");
  const res = await fetch(BUNGIE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams(body).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bungie token request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as RawTokenResponse;
  const now = Date.now();
  return {
    accessToken: data.access_token,
    accessExpiresAt: now + data.expires_in * 1000,
    refreshToken: data.refresh_token,
    refreshExpiresAt: now + data.refresh_expires_in * 1000,
    membershipId: data.membership_id,
  };
}

/** Exchange an authorization code for tokens (after the Bungie redirect). */
export function exchangeCode(code: string): Promise<BungieTokens> {
  return requestToken({ grant_type: "authorization_code", code });
}

/** Mint a fresh access token (and rotated refresh token) from a refresh token. */
export function refreshTokens(refreshToken: string): Promise<BungieTokens> {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}
