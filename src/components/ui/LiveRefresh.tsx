"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders the current server page every `intervalMs` while the tab is
 * visible. Used where people wait on someone else: a guest watching their
 * request move, staff watching a queue. Stops when `active` is false (e.g.
 * nothing left in progress), so idle pages cost nothing.
 */
export function LiveRefresh({ intervalMs = 10_000, active = true }: { intervalMs?: number; active?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs, active]);
  return null;
}
