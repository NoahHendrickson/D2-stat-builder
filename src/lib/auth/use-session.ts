"use client";

import { useQuery } from "@tanstack/react-query";

export interface SessionUser {
  membershipId: string;
  destinyMembershipId?: string;
  destinyMembershipType?: number;
  displayName?: string;
}

export interface SessionState {
  authenticated: boolean;
  user?: SessionUser;
}

/** Current auth session. The access token stays server-side. */
export function useSession() {
  return useQuery<SessionState>({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load session");
      return (await res.json()) as SessionState;
    },
    staleTime: 5 * 60_000,
  });
}
