"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/use-session";
import { useManifest } from "@/lib/manifest/use-manifest";
import { fetchArmory } from "./fetch";

/**
 * Loads + normalizes the signed-in player's armor (via the /api/bungie/profile
 * server proxy). Gated on an authenticated session and a ready manifest.
 */
export function useArmory() {
  const session = useSession();
  const manifestStatus = useManifest();
  const manifest =
    manifestStatus.state === "ready" ? manifestStatus.manifest : undefined;

  const enabled = Boolean(session.data?.authenticated && manifest);

  return useQuery({
    queryKey: ["armory", manifest?.version],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: () => fetchArmory(manifest!),
  });
}
