"use client";

import { useActionState } from "react";
import { QrCode, RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Field, Input, Select } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { QrSheet } from "./QrSheet";
import type { QrRevealState } from "./types";

type Action = (prev: QrRevealState, formData: FormData) => Promise<QrRevealState>;

/**
 * Every QR-creating control on the page shares one action state, so
 * whichever was used last, its printable sheet shows in the same place.
 */
export function QrWorkbench({
  createOne,
  createAll,
  regenerate,
  locations,
  uncoveredCount,
  businessName,
  existing,
}: {
  createOne: Action;
  createAll: Action;
  regenerate: Action;
  locations: Array<{ id: string; name: string }>;
  uncoveredCount: number;
  businessName: string;
  existing: React.ReactNode;
}) {
  const [oneState, oneAction] = useActionState(createOne, { codes: [] });
  const [allState, allAction] = useActionState(createAll, { codes: [] });
  const [regenState, regenAction] = useActionState(regenerate, { codes: [] });

  // Show the sheet from whichever action ran most recently.
  const latest = [oneState, allState, regenState].find((s) => s.codes.length > 0 || s.error) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <form action={allAction} className="flex flex-col justify-between gap-4 rounded-[var(--radius-panel)] border border-lagoon-200 bg-lagoon-50 p-5">
          <div>
            <p className="font-bold text-lagoon-900">Give every location a code</p>
            <p className="mt-1 text-sm text-lagoon-800">
              {uncoveredCount > 0
                ? `${uncoveredCount} room${uncoveredCount === 1 ? " or area has" : "s and areas have"} no QR code yet. Buildings and floors are skipped.`
                : "Every room and area already has a code."}
            </p>
          </div>
          <SubmitButton pendingLabel="Creating codes" disabled={uncoveredCount === 0}>
            <QrCode className="size-4" aria-hidden />
            Create {uncoveredCount > 0 ? uncoveredCount : ""} codes
          </SubmitButton>
        </form>

        <form action={oneAction} className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-line bg-surface p-5">
          <p className="font-bold">One code</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Location" htmlFor="qr-loc">
              <Select id="qr-loc" name="locationId" required defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Label" htmlFor="qr-label" optional>
              <Input id="qr-label" name="label" maxLength={60} placeholder="Bedside" />
            </Field>
          </div>
          <SubmitButton variant="secondary" pendingLabel="Creating">
            Create code
          </SubmitButton>
        </form>
      </div>

      {latest?.error && <Alert tone="error">{latest.error}</Alert>}
      {latest && latest.codes.length > 0 && (
        <QrSheet codes={latest.codes} businessName={businessName} message={latest.message} />
      )}

      {/* The server-rendered list of existing codes, with a replace control
          per row that feeds the same sheet above. */}
      <form action={regenAction} id="qr-regenerate" className="hidden" />
      {existing}
    </div>
  );
}

/**
 * Rendered per row by the server list. Submits the shared hidden form
 * above: a submit button's own name/value travel with the form it targets,
 * so the new code's printable card appears in the shared sheet.
 */
export function ReplaceCodeButton({ qrCodeId, locationName }: { qrCodeId: string; locationName: string }) {
  return (
    <button
      type="submit"
      form="qr-regenerate"
      name="qrCodeId"
      value={qrCodeId}
      className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] border border-line-strong px-3 text-[13px] font-semibold text-ink hover:bg-sunken"
      title={`Make a new code for ${locationName}. The old printed code stops working.`}
    >
      <RefreshCw className="size-3.5" aria-hidden />
      Replace
    </button>
  );
}
