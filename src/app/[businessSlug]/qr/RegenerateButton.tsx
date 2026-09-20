"use client";

import { useActionState } from "react";
import type { QrRevealState } from "./types";

export function RegenerateButton({
  action,
  qrCodeId,
}: {
  action: (prevState: QrRevealState | null, formData: FormData) => Promise<QrRevealState | null>;
  qrCodeId: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={formAction}>
        <input type="hidden" name="qrCodeId" value={qrCodeId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-gray-300 px-3 py-1 text-xs font-medium disabled:opacity-40"
        >
          {pending ? "Regenerating…" : "Regenerate"}
        </button>
      </form>

      {state && (
        <div className="flex items-center gap-3 rounded bg-amber-50 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a
              generated data: URL, not an optimizable remote/static asset */}
          <img src={state.imageDataUrl} alt="Scannable QR code" width={100} height={100} />
          <div className="text-xs">
            <p className="font-medium text-amber-800">
              New link — the old QR print-out no longer works.
            </p>
            <p className="mt-1 break-all text-amber-700">{state.url}</p>
          </div>
        </div>
      )}
    </div>
  );
}
