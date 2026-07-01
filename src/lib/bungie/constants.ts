/** Public Bungie endpoints + keys (safe to reference from server and browser). */

export const BUNGIE_AUTHORIZE_URL = "https://www.bungie.net/en/oauth/authorize";
export const BUNGIE_TOKEN_URL = "https://www.bungie.net/platform/app/oauth/token/";
export const BUNGIE_PLATFORM_BASE = "https://www.bungie.net/Platform";

/** Base URL for Bungie-hosted images. Manifest icon paths are relative (e.g. `/common/...`). */
export const BUNGIE_IMAGE_BASE = "https://www.bungie.net";

/** Sent as X-API-Key on every Bungie API request. Public by design. */
export const BUNGIE_API_KEY = process.env.NEXT_PUBLIC_BUNGIE_API_KEY ?? "";

/** This app's base URL; used to construct the OAuth redirect URI. */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:4321";

/** The single OAuth redirect URI — must exactly match the Bungie portal registration. */
export const OAUTH_REDIRECT_URI = `${APP_URL}/api/auth/callback`;
