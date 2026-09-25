"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Field, Input, Select } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { InviteRevealState } from "./types";

const ROLE_OPTIONS = [
  { value: "STAFF", label: "Staff", hint: "Handles requests" },
  { value: "MANAGER", label: "Manager", hint: "Runs operations and setup" },
  { value: "BUSINESS_OWNER", label: "Owner", hint: "Everything, including team access" },
];

/**
 * Adds a team member with a temporary password shown once. They sign in
 * with it and change it from their account page.
 */
export function InviteStaffForm({
  action,
  departments,
  canAssignOwner,
  signInUrl,
}: {
  action: (prev: InviteRevealState | null, formData: FormData) => Promise<InviteRevealState | null>;
  departments: Array<{ id: string; name: string }>;
  canAssignOwner: boolean;
  signInUrl: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [dismissed, setDismissed] = useState<number | undefined>(undefined);

  if (state && !state.error && state.temporaryPassword && state.nonce !== dismissed) {
    const message = `Hi ${state.name}, your OneWeb account is ready.\nSign in: ${signInUrl}\nEmail: ${state.email}\nTemporary password: ${state.temporaryPassword}\nPlease change it after signing in.`;
    return (
      <div className="animate-ticket-in flex flex-col gap-4">
        <Alert tone="success" title={`${state.name} is added`}>
          Give them these sign-in details. The password is shown once; they should change it after signing in.
        </Alert>
        <dl className="grid gap-2 rounded-[var(--radius-control)] bg-sunken p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">Email</dt>
            <dd className="font-semibold break-all">{state.email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">Temporary password</dt>
            <dd className="font-bold break-all tabular">{state.temporaryPassword}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={message} label="Copy sign-in message" />
          <Button size="sm" onClick={() => setDismissed(state.nonce)}>
            <UserPlus className="size-4" aria-hidden />
            Add another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" key={state?.nonce ?? 0}>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Name" htmlFor="inv-name">
        <Input id="inv-name" name="name" required maxLength={120} autoComplete="off" />
      </Field>
      <Field label="Email" htmlFor="inv-email">
        <Input id="inv-email" name="email" type="email" required maxLength={254} autoComplete="off" />
      </Field>
      <fieldset>
        <legend className="text-sm font-semibold">Role</legend>
        <div className="mt-2 grid gap-2">
          {ROLE_OPTIONS.filter((r) => canAssignOwner || r.value !== "BUSINESS_OWNER").map((r) => (
            <label
              key={r.value}
              className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-line-strong px-3 py-2.5 has-[:checked]:border-lagoon-600 has-[:checked]:bg-lagoon-50"
            >
              <input type="radio" name="role" value={r.value} defaultChecked={r.value === "STAFF"} className="size-4 accent-lagoon-700" />
              <span>
                <span className="block text-sm font-bold">{r.label}</span>
                <span className="text-xs text-ink-faint">{r.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Department" htmlFor="inv-dept" optional hint="Staff see requests for their department.">
        <Select id="inv-dept" name="departmentId" defaultValue="">
          <option value="">None</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton pendingLabel="Adding">Add team member</SubmitButton>
    </form>
  );
}
