"use client";

import { useEffect, useState } from "react";
import { loadManifest, type Manifest } from "./load";

export type ManifestStatus =
  | { state: "idle" }
  | { state: "loading"; message: string }
  | { state: "ready"; manifest: Manifest }
  | { state: "error"; message: string };

// Load once per page session; share across components.
let cachedManifest: Manifest | null = null;
let inflight: Promise<Manifest> | null = null;

export function useManifest(): ManifestStatus {
  const [status, setStatus] = useState<ManifestStatus>(() =>
    cachedManifest
      ? { state: "ready", manifest: cachedManifest }
      : { state: "idle" },
  );

  useEffect(() => {
    if (cachedManifest) {
      setStatus({ state: "ready", manifest: cachedManifest });
      return;
    }

    let active = true;
    setStatus({ state: "loading", message: "Loading manifest…" });
    const promise =
      inflight ??
      (inflight = loadManifest((message) => {
        if (active) setStatus({ state: "loading", message });
      }));

    promise
      .then((manifest) => {
        cachedManifest = manifest;
        inflight = null;
        if (active) setStatus({ state: "ready", manifest });
      })
      .catch((err: unknown) => {
        inflight = null;
        if (active) {
          setStatus({
            state: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return status;
}
