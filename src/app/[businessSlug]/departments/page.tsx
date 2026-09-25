import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { Building2, Plus } from "lucide-react";
import { getStaffContext } from "@/lib/staff-context";
import { permissionsForActor } from "@/modules/auth/permissions";
import { listDepartmentsForBusiness } from "@/modules/departments/repository";
import { createDepartment, updateDepartment } from "@/modules/departments/service";
import { listStaffForBusiness } from "@/modules/staff/repository";
import { listAllServicesForBusiness } from "@/modules/services/repository";
import { runAction, textField } from "@/lib/actions";
import { ActionForm, type ActionResult } from "@/components/ui/ActionForm";
import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/Layout";
import { Field, Input } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const metadata: Metadata = { title: "Departments" };

const SUGGESTED = ["Housekeeping", "Maintenance", "Room Service", "Front Office", "Concierge", "Restaurant", "Spa", "Security"];

export default async function DepartmentsPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  const { business, actor } = await getStaffContext(businessSlug);
  if (!permissionsForActor(actor).has("department:manage")) redirect(`/${businessSlug}/dashboard`);

  const [departments, staff, services] = await Promise.all([
    listDepartmentsForBusiness(business.id),
    listStaffForBusiness(business.id),
    listAllServicesForBusiness(business.id),
  ]);
  const path = `/${businessSlug}/departments`;
  const existing = new Set(departments.map((d: { name: string }) => d.name.toLowerCase()));
  const suggestions = SUGGESTED.filter((s) => !existing.has(s.toLowerCase()));

  const countBy = (rows: Array<{ departmentId: string | null; status?: string }>, id: string) =>
    rows.filter((r) => r.departmentId === id && (r.status === undefined || r.status === "ACTIVE")).length;

  async function create(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    const result = await runAction("departments.create", async () => {
      const d = await createDepartment(actor, {
        name: textField(formData, "name") ?? "",
        description: textField(formData, "description"),
      });
      return `Added ${d.name}.`;
    });
    revalidatePath(path);
    return result;
  }

  async function quickAdd(formData: FormData) {
    "use server";
    const name = textField(formData, "name");
    if (name) await runAction("departments.quick", async () => void (await createDepartment(actor, { name })));
    revalidatePath(path);
  }

  async function rename(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    const id = textField(formData, "departmentId");
    const result = await runAction("departments.rename", async () => {
      if (!id) return;
      await updateDepartment(actor, id, {
        name: textField(formData, "name") ?? "",
        description: textField(formData, "description"),
      });
      return "Saved.";
    });
    revalidatePath(path);
    return result;
  }

  return (
    <>
      <PageHeader
        title="Departments"
        description="Teams that handle requests. Each service is routed to a department, and staff can belong to one."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
        <Panel>
          <PanelHeader title="Add a department" />
          <div className="flex flex-col gap-5 p-5">
            {suggestions.length > 0 && (
              <div>
                <p className="text-sm font-semibold">Common for hotels</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map((name) => (
                    <form key={name} action={quickAdd}>
                      <input type="hidden" name="name" value={name} />
                      <SubmitButton variant="secondary" size="sm" pendingLabel={name}>
                        <Plus className="size-3.5" aria-hidden />
                        {name}
                      </SubmitButton>
                    </form>
                  ))}
                </div>
              </div>
            )}
            <ActionForm action={create} className="flex flex-col gap-4">
              <Field label="Name" htmlFor="name">
                <Input id="name" name="name" required maxLength={60} placeholder="Guest Relations" />
              </Field>
              <Field label="Description" htmlFor="description" optional>
                <Input id="description" name="description" maxLength={200} />
              </Field>
              <SubmitButton pendingLabel="Adding">Add department</SubmitButton>
            </ActionForm>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader title="Your departments" description={`${departments.length} in total`} />
          {departments.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Building2 className="size-6" />} title="No departments yet">
                Add the teams that will handle guest requests.
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {departments.map((d: { id: string; name: string; description: string | null }) => (
                <li key={d.id} className="px-5 py-4">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-4 [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{d.name}</p>
                        {d.description && <p className="text-sm text-ink-soft">{d.description}</p>}
                      </div>
                      <p className="hidden text-sm text-ink-faint sm:block tabular">
                        {countBy(staff, d.id)} staff, {countBy(services.map((s: { departmentId: string | null }) => ({ departmentId: s.departmentId })), d.id)} services
                      </p>
                      <span className="text-sm font-semibold text-lagoon-700 group-open:hidden">Edit</span>
                      <span className="hidden text-sm font-semibold text-ink-faint group-open:inline">Close</span>
                    </summary>
                    <ActionForm action={rename} resetOnSuccess={false} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
                      <input type="hidden" name="departmentId" value={d.id} />
                      <Field label="Name" htmlFor={`n-${d.id}`}>
                        <Input id={`n-${d.id}`} name="name" defaultValue={d.name} required maxLength={60} />
                      </Field>
                      <Field label="Description" htmlFor={`d-${d.id}`} optional>
                        <Input id={`d-${d.id}`} name="description" defaultValue={d.description ?? ""} maxLength={200} />
                      </Field>
                      <SubmitButton pendingLabel="Saving">Save</SubmitButton>
                    </ActionForm>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
