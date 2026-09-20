"use client";

import { useActionState } from "react";
import type { CheckInRevealState } from "./types";

type Location = { id: string; name: string };

function defaultCheckOut(): string {
  // Sensible default: tomorrow at 11:00 (a common hotel checkout time), in
  // the shape <input type="datetime-local"> expects. Staff can change it.
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(11, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CheckInForm({
  action,
  locations,
}: {
  action: (
    prevState: CheckInRevealState | null,
    formData: FormData,
  ) => Promise<CheckInRevealState | null>;
  locations: Location[];
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="flex flex-col gap-3 rounded border border-gray-200 p-4">
      <h2 className="text-sm font-semibold">Check in a guest</h2>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          Guest name
          <input
            name="guestFullName"
            required
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Email (optional)
          <input
            type="email"
            name="guestEmail"
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Phone (optional)
          <input name="guestPhone" className="rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Room / location
          <select name="locationId" className="rounded border border-gray-300 px-2 py-1 text-sm">
            <option value="">— none —</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Checkout
          <input
            type="datetime-local"
            name="checkOutAt"
            required
            defaultValue={defaultCheckOut()}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {pending ? "Checking in…" : "Check in"}
        </button>
      </form>

      {state?.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      {state && !state.error && (
        <div className="rounded bg-amber-50 p-3 text-xs">
          <p className="font-medium text-amber-800">
            {state.guestName} is checked in. Send this activation link to their phone — it
            won&apos;t be shown again:
          </p>
          <p className="mt-1 break-all text-amber-700">{state.activationUrl}</p>
        </div>
      )}
    </div>
  );
}
