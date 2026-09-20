"use client";

import { useActionState } from "react";
import type { QrRevealState } from "./types";

type Location = { id: string; name: string };

export function QrCreateForm({
  action,
  locations,
}: {
  action: (prevState: QrRevealState | null, formData: FormData) => Promise<QrRevealState | null>;
  locations: Location[];
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="flex flex-col gap-3 rounded border border-gray-200 p-4">
      <h2 className="text-sm font-semibold">New QR code</h2>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          Location
          <select name="locationId" required className="rounded border border-gray-300 px-2 py-1 text-sm">
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Label (optional)
          <input name="label" className="rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {pending ? "Creating…" : "Create QR"}
        </button>
      </form>

      {state && (
        <div className="flex items-center gap-4 rounded bg-amber-50 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a
              generated data: URL, not an optimizable remote/static asset */}
          <img src={state.imageDataUrl} alt="Scannable QR code" width={120} height={120} />
          <div className="text-xs">
            <p className="font-medium text-amber-800">
              Save or print this now — the underlying link won&apos;t be shown again.
            </p>
            <p className="mt-1 break-all text-amber-700">{state.url}</p>
          </div>
        </div>
      )}
    </div>
  );
}
