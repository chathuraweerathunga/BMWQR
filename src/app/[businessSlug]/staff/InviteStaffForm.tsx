"use client";

import { useActionState } from "react";
import type { InviteRevealState } from "./types";

type Department = { id: string; name: string };

const ROLES = ["STAFF", "MANAGER", "BUSINESS_OWNER"] as const;

export function InviteStaffForm({
  action,
  departments,
  canAssignOwner,
}: {
  action: (
    prevState: InviteRevealState | null,
    formData: FormData,
  ) => Promise<InviteRevealState | null>;
  departments: Department[];
  canAssignOwner: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="flex flex-col gap-3 rounded border border-gray-200 p-4">
      <h2 className="text-sm font-semibold">Invite a staff member</h2>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          Name
          <input name="name" required className="rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Role
          <select name="role" className="rounded border border-gray-300 px-2 py-1 text-sm">
            {ROLES.filter((role) => canAssignOwner || role !== "BUSINESS_OWNER").map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Department (optional)
          <select name="departmentId" className="rounded border border-gray-300 px-2 py-1 text-sm">
            <option value="">None</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {pending ? "Inviting…" : "Invite"}
        </button>
      </form>

      {state?.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      {state && !state.error && (
        <div className="rounded bg-amber-50 p-3 text-xs">
          <p className="font-medium text-amber-800">
            {state.name} ({state.email}) is set up. Share this temporary password with them —
            it won&apos;t be shown again:
          </p>
          <p className="mt-1 break-all font-mono text-amber-700">{state.temporaryPassword}</p>
        </div>
      )}
    </div>
  );
}
