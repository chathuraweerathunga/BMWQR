"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Catch-all for unexpected failures. Shows a plain message and the error's
 * digest (an opaque id that matches the server log entry) so support can
 * find the details, never the message or stack itself (section 46).
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">This page didn&apos;t load</h1>
      <p className="text-[15px] text-ink-soft">
        Something went wrong on our side. Try again, and if it keeps happening, share this reference with
        support.
      </p>
      {error.digest && (
        <p className="rounded-[var(--radius-control)] bg-sunken px-3 py-1.5 text-sm text-ink-soft tabular">
          Reference {error.digest}
        </p>
      )}
      <Button onClick={reset}>
        <RotateCcw className="size-4" aria-hidden />
        Try again
      </Button>
    </main>
  );
}
