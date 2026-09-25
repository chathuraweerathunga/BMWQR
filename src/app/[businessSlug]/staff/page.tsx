import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { getStaffContext } from "@/lib/staff-context";
import { permissionsForActor } from "@/modules/auth/permissions";
import { listStaffForBusiness } from "@/modules/staff/repository";
import { listDepartmentsForBusiness } from "@/modules/departments/repository";
import { disableStaffMember, enableStaffMember, inviteStaffMember } from "@/modules/staff/service";
import { AuthorizationError, type MembershipRole } from "@/modules/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { env } from "@/lib/env";
import { runAction, textField } from "@/lib/actions";
import { Avatar, PageHeader, Panel, PanelHeader } from "@/components/ui/Layout";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Pill } from "@/components/ui/Status";
import { cn } from "@/lib/cn";
import { InviteStaffForm } from "./InviteStaffForm";
import type { InviteRevealState } from "./types";

export const metadata: Metadata = { title: "Team" };

const ROLE_LABEL: Record<string, string> = { BUSINESS_OWNER: "Owner", MANAGER: "Manager", STAFF: "Staff" };

export default async function StaffPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  const { business, actor } = await getStaffContext(businessSlug);
  const permissions = permissionsForActor(actor);
  if (!permissions.has("staff:invite")) redirect(`/${businessSlug}/dashboard`);
  const canDisable = permissions.has("staff:disable");

  const [staff, departments] = await Promise.all([
    listStaffForBusiness(business.id),
    listDepartmentsForBusiness(business.id),
  ]);
  const path = `/${businessSlug}/staff`;

  async function inviteAction(_prev: InviteRevealState | null, formData: FormData): Promise<InviteRevealState | null> {
    "use server";
    const fail = (error: string): InviteRevealState => ({ name: "", email: "", temporaryPassword: "", error });
    try {
      const result = await inviteStaffMember(actor, {
        name: textField(formData, "name") ?? "",
        email: textField(formData, "email") ?? "",
        role: (textField(formData, "role") ?? "STAFF") as MembershipRole,
        departmentId: textField(formData, "departmentId"),
      });
      revalidatePath(path);
      return {
        name: result.user.name,
        email: result.user.email,
        temporaryPassword: result.temporaryPassword,
        nonce: new Date().getTime(),
      };
    } catch (err) {
      if (err instanceof AuthorizationError) return fail("You can't give someone that role.");
      if (err instanceof ValidationError) return fail(err.message);
      if (err instanceof NotFoundError) return fail("That department no longer exists.");
      console.error("[staff.invite] unexpected failure", err);
      return fail("That team member couldn't be added. Try again.");
    }
  }

  async function setAccess(formData: FormData) {
    "use server";
    const membershipId = textField(formData, "membershipId");
    const enable = formData.get("enable") === "true";
    if (!membershipId) return;
    await runAction("staff.access", async () => {
      if (enable) await enableStaffMember(actor, membershipId);
      else await disableStaffMember(actor, membershipId);
    });
    revalidatePath(path);
  }

  type Member = {
    id: string;
    role: string;
    status: string;
    user: { name: string; email: string };
    department: { name: string } | null;
  };
  const members = (staff as Member[]).sort(
    (a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") || a.user.name.localeCompare(b.user.name),
  );

  return (
    <>
      <PageHeader title="Team" description="Everyone who can sign in to this property, and what they can do." />
      <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
        <Panel>
          <PanelHeader title="Add a team member" />
          <div className="p-5">
            <InviteStaffForm
              action={inviteAction}
              departments={departments.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }))}
              canAssignOwner={actor.role === "BUSINESS_OWNER"}
              signInUrl={new URL("/login", env.APP_URL).toString()}
            />
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="People"
            description={`${members.filter((m) => m.status === "ACTIVE").length} with access`}
          />
          <ul className="divide-y divide-line">
            {members.map((m) => {
              const isSelf = m.id === actor.membershipId;
              const active = m.status === "ACTIVE";
              return (
                <li key={m.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3.5", !active && "bg-paper")}>
                  <Avatar name={m.user.name} className={active ? undefined : "opacity-50"} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate font-bold", !active && "text-ink-faint")}>
                      {m.user.name}
                      {isSelf && <span className="ml-1.5 font-normal text-ink-faint">(you)</span>}
                    </p>
                    <p className="truncate text-[13px] text-ink-faint">
                      {m.user.email}
                      {m.department ? `, ${m.department.name}` : ""}
                    </p>
                  </div>
                  <Pill className={m.role === "BUSINESS_OWNER" ? "bg-brass-100 text-brass-700" : undefined}>
                    {ROLE_LABEL[m.role] ?? m.role}
                  </Pill>
                  {!active && <Pill className="bg-danger-bg text-danger">No access</Pill>}
                  {canDisable && !isSelf && (
                    <form action={setAccess}>
                      <input type="hidden" name="membershipId" value={m.id} />
                      <input type="hidden" name="enable" value={active ? "false" : "true"} />
                      {active ? (
                        <ConfirmSubmit confirmLabel="Remove access">Remove access</ConfirmSubmit>
                      ) : (
                        <SubmitButton variant="secondary" size="sm" pendingLabel="Restoring">
                          Restore access
                        </SubmitButton>
                      )}
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}
