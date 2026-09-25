"use client";

/* eslint-disable @next/next/no-img-element -- a data: URL QR image */
import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Field, Input, Select } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { CheckInRevealState } from "./types";

type Location = { id: string; name: string };

/**
 * Reception's check-in form. On success the guest's private link is shown
 * ONCE, as a QR code to scan from the desk and as a link to copy. It is
 * never stored in plain text or put in a URL, so it can't be shown again.
 */
export function CheckInForm({
  action,
  locations,
  defaultCheckOut,
  timezoneLabel,
}: {
  action: (prev: CheckInRevealState | null, formData: FormData) => Promise<CheckInRevealState | null>;
  locations: Location[];
  defaultCheckOut: string;
  timezoneLabel: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [dismissedNonce, setDismissedNonce] = useState<number | undefined>(undefined);
  const showReveal = state && !state.error && state.activationUrl && state.nonce !== dismissedNonce;

  if (showReveal) {
    return (
      <div className="animate-ticket-in flex flex-col items-center gap-4 text-center">
        <p className="text-sm font-semibold text-st-done">Checked in</p>
        <h3 className="-mt-2 text-xl font-extrabold">{state.guestName}</h3>
        <p className="max-w-xs text-sm text-ink-soft">
          Ask the guest to scan this with their phone camera. It opens guest services for their stay.
        </p>
        {state.activationQr && (
          <img
            src={state.activationQr}
            alt={`Guest services QR code for ${state.guestName}`}
            className="size-56 rounded-[var(--radius-panel)] border border-line bg-white p-2"
          />
        )}
        <div className="w-full rounded-[var(--radius-control)] bg-sunken px-3 py-2 text-left text-xs break-all text-ink-soft">
          {state.activationUrl}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <CopyButton value={state.activationUrl} />
          <Button size="sm" onClick={() => setDismissedNonce(state.nonce)}>
            <UserPlus className="size-4" aria-hidden />
            Next guest
          </Button>
        </div>
        <p className="text-xs text-ink-faint">This link is shown once. Share it only with the guest.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" key={state?.nonce ?? 0}>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Guest name" htmlFor="guestFullName">
        <Input id="guestFullName" name="guestFullName" required maxLength={120} autoComplete="off" />
      </Field>
      <Field label="Room" htmlFor="locationId">
        <Select id="locationId" name="locationId" defaultValue="">
          <option value="">No room (walk-in, day guest)</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Checkout" htmlFor="checkOutAt" hint={`Property time (${timezoneLabel}). Access ends then.`}>
        <Input id="checkOutAt" type="datetime-local" name="checkOutAt" required defaultValue={defaultCheckOut} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="guestEmail" optional>
          <Input id="guestEmail" type="email" name="guestEmail" maxLength={254} autoComplete="off" />
        </Field>
        <Field label="Phone" htmlFor="guestPhone" optional>
          <Input id="guestPhone" type="tel" name="guestPhone" maxLength={40} autoComplete="off" />
        </Field>
      </div>
      <SubmitButton pendingLabel="Checking in" size="lg" block>
        Check in guest
      </SubmitButton>
    </form>
  );
}
