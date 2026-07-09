"use client";

import { useEffect, useState } from "react";

/** True when the URL includes `?debug` (any value) — opt-in armory diagnostics. */
export function useArmoryDebug(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(new URLSearchParams(window.location.search).has("debug"));
  }, []);

  return enabled;
}
