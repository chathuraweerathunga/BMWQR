"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { BellRing, X } from "lucide-react";

interface Pulse {
  newCount: number;
  newest: { id: string; title: string; location: string | null; createdAt: string } | null;
  version: string;
}

const POLL_MS = 15_000;

/** A short two-tone chime. Browsers only allow audio after the page has
 * had a user interaction; before that this silently does nothing. */
function chime() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const t = ctx.currentTime + i * 0.14;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // Audio is a nicety; never let it break the page.
  }
}

/**
 * In-app notifications for staff (project instructions section 21, first
 * channel). Polls the pulse endpoint, and when a new request arrives:
 * shows a toast, plays a chime, updates the sidebar badge and tab title,
 * and refreshes the requests board if it's open. Polling pauses while the
 * tab is hidden and catches up the moment it's visible again.
 */
export function RequestPulse({ businessSlug }: { businessSlug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const lastVersion = useRef<string | null>(null);
  const lastNewestId = useRef<string | null>(null);
  const [toast, setToast] = useState<Pulse["newest"]>(null);
  const baseTitle = useRef<string | null>(null);

  const dashboardPath = `/${businessSlug}/dashboard`;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (baseTitle.current === null) baseTitle.current = document.title.replace(/^\(\d+\+?\)\s*/, "");

    async function poll() {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/b/${businessSlug}/pulse`, { cache: "no-store" });
          if (res.ok && !cancelled) {
            const pulse = (await res.json()) as Pulse;
            window.dispatchEvent(new CustomEvent("oneweb:new-count", { detail: pulse.newCount }));
            document.title = pulse.newCount
              ? `(${pulse.newCount}) ${baseTitle.current}`
              : (baseTitle.current ?? document.title);

            const isFirstPoll = lastVersion.current === null;
            const arrived = pulse.newest && pulse.newest.id !== lastNewestId.current;
            if (!isFirstPoll && arrived) {
              setToast(pulse.newest);
              chime();
            }
            if (!isFirstPoll && pulse.version !== lastVersion.current && pathname === dashboardPath) {
              router.refresh();
            }
            lastVersion.current = pulse.version;
            lastNewestId.current = pulse.newest?.id ?? null;
          }
        } catch {
          // Offline or a transient error: try again on the next tick.
        }
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void poll();
      }
    };

    void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [businessSlug, pathname, dashboardPath, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-ticket-in fixed bottom-4 right-4 left-4 z-50 flex items-start gap-3 rounded-[var(--radius-panel)] border border-lagoon-700 bg-lagoon-900 p-4 text-white shadow-[var(--shadow-lift)] sm:left-auto sm:w-96"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brass-500 text-lagoon-900">
        <BellRing className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">New request{toast.location ? ` in ${toast.location}` : ""}</p>
        <p className="mt-0.5 truncate text-sm text-white/75">{toast.title}</p>
        {pathname !== dashboardPath && (
          <Link href={dashboardPath} className="mt-2 inline-block text-sm font-semibold text-brass-300 hover:underline">
            Open requests
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={() => setToast(null)}
        className="grid size-8 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
