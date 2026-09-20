import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff-context";
import { listStaffForBusiness } from "@/modules/staff/repository";
import { listDepartmentsForBusiness } from "@/modules/departments/repository";
import { inviteStaffMember, disableStaffMember } from "@/modules/staff/service";
import { AuthorizationError, type MembershipRole } from "@/modules/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { InviteStaffForm } from "./InviteStaffForm";
import type { InviteRevealState } from "./types";

export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { businessSlug } = await params;
  const { error } = await searchParams;
  const { business, actor } = await getStaffContext(businessSlug);

  // Route-level guard mirroring the other management pages: the layout
  // only hides the nav link for STAFF. `inviteStaffMember`/
  // `disableStaffMember` re-check `staff:invite`/`staff:disable`
  // regardless — MANAGER can view and invite (but not assign
  // BUSINESS_OWNER or disable anyone; see modules/staff/service.ts).
  if (actor.role !== "BUSINESS_OWNER" && actor.role !== "MANAGER") {
    redirect(`/${businessSlug}/dashboard`);
  }

  const [staff, departments] = await Promise.all([
    listStaffForBusiness(business.id),
    listDepartmentsForBusiness(business.id),
  ]);

  async function inviteAction(
    _prevState: InviteRevealState | null,
    formData: FormData,
  ): Promise<InviteRevealState | null> {
    "use server";
    const name = formData.get("name");
    const email = formData.get("email");
    const role = formData.get("role");
    const departmentId = formData.get("departmentId");

    if (typeof name !== "string" || !name.trim()) {
      return { name: "", email: "", temporaryPassword: "", error: "Name is required." };
    }
    if (typeof email !== "string" || !email.trim()) {
      return { name: "", email: "", temporaryPassword: "", error: "Email is required." };
    }
    if (typeof role !== "string") {
      return { name: "", email: "", temporaryPassword: "", error: "Role is required." };
    }

    try {
      const result = await inviteStaffMember(actor, {
        name,
        email,
        role: role as MembershipRole,
        departmentId: typeof departmentId === "string" && departmentId ? departmentId : null,
      });
      return {
        name: result.user.name,
        email: result.user.email,
        temporaryPassword: result.temporaryPassword,
      };
    } catch (err) {
      const message =
        err instanceof AuthorizationError
          ? "You don't have permission to invite that role."
          : err instanceof ValidationError || err instanceof NotFoundError
            ? err.message
            : "Something went wrong — please try again.";
      return { name: "", email: "", temporaryPassword: "", error: message };
    }
  }

  async function disableAction(formData: FormData) {
    "use server";
    const membershipId = formData.get("membershipId");
    if (typeof membershipId !== "string") return;

    try {
      await disableStaffMember(actor, membershipId);
    } catch (err) {
      const message =
        err instanceof AuthorizationError
          ? "NOT_ALLOWED"
          : err instanceof ValidationError
            ? encodeURIComponent(err.message)
            : err instanceof NotFoundError
              ? "NOT_FOUND"
              : "UNKNOWN";
      redirect(`/${businessSlug}/staff?error=${message}`);
    }
    redirect(`/${businessSlug}/staff`);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">Staff</h1>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {["NOT_ALLOWED", "NOT_FOUND", "UNKNOWN"].includes(error)
            ? "That action couldn't be completed."
            : decodeURIComponent(error)}
        </p>
      )}

      <InviteStaffForm
        action={inviteAction}
        departments={departments}
        canAssignOwner={actor.role === "BUSINESS_OWNER"}
      />

      <ul className="flex flex-col gap-2">
        {staff.map((member: (typeof staff)[number]) => (
          <li
            key={member.id}
            className="flex items-center justify-between rounded border border-gray-200 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">
                {member.user.name}
                <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {member.role}
                </span>
                <span
                  className={`ml-2 rounded px-2 py-0.5 text-xs ${
                    member.status === "ACTIVE"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {member.status}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                {member.user.email}
                {member.department ? ` · ${member.department.name}` : ""}
              </p>
            </div>
            {actor.role === "BUSINESS_OWNER" &&
              member.status === "ACTIVE" &&
              member.id !== actor.membershipId && (
                <form action={disableAction}>
                  <input type="hidden" name="membershipId" value={member.id} />
                  <button
                    type="submit"
                    className="rounded border border-gray-300 px-3 py-1 text-xs font-medium"
                  >
                    Disable
                  </button>
                </form>
              )}
          </li>
        ))}
      </ul>
    </div>
  );
}
