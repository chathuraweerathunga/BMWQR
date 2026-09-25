import type { Metadata } from "next";
import { getStaffContext } from "@/lib/staff-context";
import { getCurrentUserId } from "@/lib/session";
import { changeOwnPassword } from "@/modules/staff/service";
import { getUserById } from "@/modules/staff/repository";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { runAction } from "@/lib/actions";
import { ActionForm, type ActionResult } from "@/components/ui/ActionForm";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/Layout";
import { Field, Input } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  await getStaffContext(businessSlug); // access check
  const userId = await getCurrentUserId();
  const user = userId ? await getUserById(userId) : null;

  async function changePassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    const uid = await getCurrentUserId();
    if (!uid) return { error: "Your session has ended. Sign in again." };
    const limit = await rateLimit(`pw-change:${uid}:${getClientIp(await headers())}`, 5, 15 * 60_000);
    if (!limit.allowed) return { error: "Too many attempts. Try again in 15 minutes." };

    const current = formData.get("current");
    const next = formData.get("next");
    const confirm = formData.get("confirm");
    if (typeof current !== "string" || typeof next !== "string" || typeof confirm !== "string") {
      return { error: "Fill in all three fields." };
    }
    if (next !== confirm) return { error: "The new passwords don't match." };
    return runAction("account.password", async () => {
      await changeOwnPassword(uid, current, next);
      return "Password changed. Use the new one next time you sign in.";
    });
  }

  return (
    <>
      <PageHeader title="Your account" description={user ? `Signed in as ${user.email}` : undefined} />
      <Panel className="max-w-lg">
        <PanelHeader
          title="Change password"
          description="If you were given a temporary password, replace it here."
        />
        <ActionForm action={changePassword} className="flex flex-col gap-4 p-5">
          <Field label="Current password" htmlFor="current">
            <Input id="current" name="current" type="password" autoComplete="current-password" required maxLength={200} />
          </Field>
          <Field label="New password" htmlFor="next" hint="At least 8 characters.">
            <Input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
          </Field>
          <Field label="Repeat new password" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
          </Field>
          <div>
            <SubmitButton pendingLabel="Saving">Change password</SubmitButton>
          </div>
        </ActionForm>
      </Panel>
    </>
  );
}
