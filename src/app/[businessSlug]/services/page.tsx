import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { ConciergeBell } from "lucide-react";
import { getStaffContext } from "@/lib/staff-context";
import { permissionsForActor } from "@/modules/auth/permissions";
import { listAllServicesForBusiness } from "@/modules/services/repository";
import { createService, setServiceActive, updateService } from "@/modules/services/service";
import { listDepartmentsForBusiness } from "@/modules/departments/repository";
import { SERVICE_ICON_KEYS } from "@/modules/services/icons";
import { runAction, textField } from "@/lib/actions";
import { ActionForm, type ActionResult } from "@/components/ui/ActionForm";
import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/Layout";
import { Field, Input, Select } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PriorityMark } from "@/components/ui/Status";
import { SERVICE_ICONS, ServiceIcon, serviceIconKey } from "@/components/guest/ServiceIcon";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Services" };

type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  departmentId: string | null;
  defaultPriority: string;
  estimatedMinutes: number | null;
  isActive: boolean;
  department: { name: string } | null;
}

function readServiceForm(formData: FormData) {
  const minutes = textField(formData, "estimatedMinutes");
  return {
    name: textField(formData, "name") ?? "",
    description: textField(formData, "description"),
    icon: textField(formData, "icon"),
    departmentId: textField(formData, "departmentId"),
    defaultPriority: (textField(formData, "defaultPriority") ?? "NORMAL") as Priority,
    estimatedMinutes: minutes ? Number(minutes) : null,
  };
}

function ServiceFields({
  idPrefix,
  departments,
  service,
}: {
  idPrefix: string;
  departments: Array<{ id: string; name: string }>;
  service?: ServiceRow;
}) {
  const icon = service ? serviceIconKey(service.icon, service.name) : "general";
  return (
    <>
      <Field label="Name" htmlFor={`${idPrefix}-name`}>
        <Input id={`${idPrefix}-name`} name="name" required maxLength={80} defaultValue={service?.name} placeholder="Extra towels" />
      </Field>
      <Field label="Short description" htmlFor={`${idPrefix}-desc`} optional hint="Shown to guests under the name.">
        <Input id={`${idPrefix}-desc`} name="description" maxLength={300} defaultValue={service?.description ?? ""} />
      </Field>
      <fieldset>
        <legend className="text-sm font-semibold">Icon</legend>
        <div className="mt-2 grid grid-cols-6 gap-1.5">
          {SERVICE_ICON_KEYS.map((key) => {
            const { icon: Icon, label } = SERVICE_ICONS[key];
            return (
              <label
                key={key}
                title={label}
                className="grid aspect-square cursor-pointer place-items-center rounded-[var(--radius-control)] border border-line text-ink-soft hover:border-ink-faint has-[:checked]:border-lagoon-600 has-[:checked]:bg-lagoon-50 has-[:checked]:text-lagoon-700 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brass-500"
              >
                <input type="radio" name="icon" value={key} defaultChecked={key === icon} className="sr-only" />
                <Icon className="size-5" aria-hidden />
                <span className="sr-only">{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <Field label="Handled by" htmlFor={`${idPrefix}-dept`}>
        <Select id={`${idPrefix}-dept`} name="departmentId" defaultValue={service?.departmentId ?? ""}>
          <option value="">No department (front desk decides)</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority" htmlFor={`${idPrefix}-prio`}>
          <Select id={`${idPrefix}-prio`} name="defaultPriority" defaultValue={service?.defaultPriority ?? "NORMAL"}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Expected time" htmlFor={`${idPrefix}-min`} optional hint="Minutes. Late after this.">
          <Input
            id={`${idPrefix}-min`}
            name="estimatedMinutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            defaultValue={service?.estimatedMinutes ?? ""}
            placeholder="15"
          />
        </Field>
      </div>
    </>
  );
}

export default async function ServicesPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  const { business, actor } = await getStaffContext(businessSlug);
  if (!permissionsForActor(actor).has("service:manage")) redirect(`/${businessSlug}/dashboard`);

  const [services, departments] = await Promise.all([
    listAllServicesForBusiness(business.id) as Promise<ServiceRow[]>,
    listDepartmentsForBusiness(business.id),
  ]);
  const deptOptions = departments.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }));
  const path = `/${businessSlug}/services`;

  async function create(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    const result = await runAction("services.create", async () => {
      const s = await createService(actor, readServiceForm(formData));
      return `Added ${s.name}. Guests can request it now.`;
    });
    revalidatePath(path);
    return result;
  }

  async function update(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    const id = textField(formData, "serviceId");
    const result = await runAction("services.update", async () => {
      if (!id) return;
      await updateService(actor, id, readServiceForm(formData));
      return "Saved.";
    });
    revalidatePath(path);
    return result;
  }

  async function toggle(formData: FormData) {
    "use server";
    const id = textField(formData, "serviceId");
    if (!id) return;
    await runAction("services.toggle", async () => {
      await setServiceActive(actor, id, formData.get("isActive") === "true");
    });
    revalidatePath(path);
  }

  const activeCount = services.filter((s) => s.isActive).length;

  return (
    <>
      <PageHeader
        title="Services"
        description="What guests can ask for from their phone. Each service goes to a department, with an expected time."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
        <Panel>
          <PanelHeader title="Add a service" />
          <ActionForm action={create} className="flex flex-col gap-4 p-5">
            <ServiceFields idPrefix="new" departments={deptOptions} />
            <SubmitButton pendingLabel="Adding">Add service</SubmitButton>
          </ActionForm>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader title="Your services" description={`${activeCount} shown to guests, ${services.length - activeCount} hidden`} />
          {services.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<ConciergeBell className="size-6" />} title="No services yet">
                Add what guests ask for most: towels, housekeeping, room service, maintenance.
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {services.map((s) => (
                <li key={s.id} className={cn("px-5 py-4", !s.isActive && "bg-paper")}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-full",
                          s.isActive ? "bg-lagoon-50 text-lagoon-700" : "bg-sunken text-ink-faint",
                        )}
                      >
                        <ServiceIcon icon={s.icon} name={s.name} className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("font-bold", !s.isActive && "text-ink-faint")}>
                          {s.name}
                          {!s.isActive && <span className="ml-2 text-xs font-semibold">Hidden from guests</span>}
                        </p>
                        <p className="text-sm text-ink-faint">
                          {s.department?.name ?? "No department"}
                          {s.estimatedMinutes ? `, expected in ${s.estimatedMinutes} min` : ""}
                        </p>
                      </div>
                      <PriorityMark priority={s.defaultPriority} />
                      <span className="text-sm font-semibold text-lagoon-700 group-open:hidden">Edit</span>
                      <span className="hidden text-sm font-semibold text-ink-faint group-open:inline">Close</span>
                    </summary>
                    <div className="mt-4 grid gap-4 rounded-[var(--radius-panel)] border border-line bg-surface p-4">
                      <ActionForm action={update} resetOnSuccess={false} className="flex flex-col gap-4">
                        <input type="hidden" name="serviceId" value={s.id} />
                        <ServiceFields idPrefix={s.id} departments={deptOptions} service={s} />
                        <SubmitButton pendingLabel="Saving">Save changes</SubmitButton>
                      </ActionForm>
                      <form action={toggle} className="border-t border-line pt-4">
                        <input type="hidden" name="serviceId" value={s.id} />
                        <input type="hidden" name="isActive" value={s.isActive ? "false" : "true"} />
                        <SubmitButton variant={s.isActive ? "danger" : "secondary"} size="sm" pendingLabel="Saving">
                          {s.isActive ? "Hide from guests" : "Show to guests"}
                        </SubmitButton>
                      </form>
                    </div>
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
