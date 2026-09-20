import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff-context";
import { listAllServicesForBusiness } from "@/modules/services/repository";
import { createService, setServiceActive } from "@/modules/services/service";
import { listDepartmentsForBusiness } from "@/modules/departments/repository";
import { AuthorizationError } from "@/modules/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export default async function ServicesPage({
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
  // only hides the nav link for STAFF. `createService`/`setServiceActive`
  // re-check `service:manage` regardless.
  if (actor.role !== "BUSINESS_OWNER" && actor.role !== "MANAGER") {
    redirect(`/${businessSlug}/dashboard`);
  }

  const [services, departments] = await Promise.all([
    listAllServicesForBusiness(business.id),
    listDepartmentsForBusiness(business.id),
  ]);

  async function createAction(formData: FormData) {
    "use server";
    const name = formData.get("name");
    const departmentId = formData.get("departmentId");
    const defaultPriority = formData.get("defaultPriority");
    const estimatedMinutes = formData.get("estimatedMinutes");
    const description = formData.get("description");

    if (typeof name !== "string" || !name.trim()) {
      redirect(`/${businessSlug}/services?error=${encodeURIComponent("Service name is required.")}`);
    }

    try {
      await createService(actor, {
        name: name as string,
        departmentId: typeof departmentId === "string" && departmentId ? departmentId : null,
        defaultPriority:
          typeof defaultPriority === "string" && defaultPriority
            ? (defaultPriority as (typeof PRIORITIES)[number])
            : undefined,
        estimatedMinutes:
          typeof estimatedMinutes === "string" && estimatedMinutes
            ? Number(estimatedMinutes)
            : null,
        description: typeof description === "string" && description.trim() ? description : null,
      });
    } catch (err) {
      const message =
        err instanceof AuthorizationError
          ? "You don't have permission to manage services."
          : err instanceof ValidationError || err instanceof NotFoundError
            ? err.message
            : "Something went wrong — please try again.";
      redirect(`/${businessSlug}/services?error=${encodeURIComponent(message)}`);
    }
    redirect(`/${businessSlug}/services`);
  }

  async function toggleActiveAction(formData: FormData) {
    "use server";
    const serviceId = formData.get("serviceId");
    const isActive = formData.get("isActive") === "true";
    if (typeof serviceId !== "string") return;

    try {
      await setServiceActive(actor, serviceId, isActive);
    } catch (err) {
      const message =
        err instanceof AuthorizationError ? "NOT_ALLOWED" : err instanceof NotFoundError ? "NOT_FOUND" : "UNKNOWN";
      redirect(`/${businessSlug}/services?error=${message}`);
    }
    redirect(`/${businessSlug}/services`);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">Services</h1>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{decodeURIComponent(error)}</p>
      )}

      {departments.length === 0 && (
        <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Create a department first if you want this service to route to one — services can also
          be created without a department for now.
        </p>
      )}

      <form action={createAction} className="flex flex-col gap-2 rounded border border-gray-200 p-4">
        <h2 className="text-sm font-semibold">New service</h2>
        <div className="flex flex-wrap gap-2">
          <input
            name="name"
            placeholder="e.g. Extra towels"
            required
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <select name="departmentId" className="rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">No department</option>
            {departments.map((dept: (typeof departments)[number]) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          <select name="defaultPriority" className="rounded border border-gray-300 px-3 py-2 text-sm">
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            name="estimatedMinutes"
            type="number"
            min={1}
            placeholder="Est. minutes"
            className="w-32 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <input
          name="description"
          placeholder="Description (optional)"
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="self-start rounded bg-black px-3 py-1.5 text-xs font-medium text-white"
        >
          Add service
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {services.length === 0 && <p className="text-sm text-gray-500">No services yet.</p>}
        {services.map((service: (typeof services)[number]) => (
          <li
            key={service.id}
            className="flex items-center justify-between rounded border border-gray-200 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">
                {service.name}
                <span
                  className={`ml-2 rounded px-2 py-0.5 text-xs ${
                    service.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {service.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                {service.department?.name ?? "No department"} · {service.defaultPriority}
                {service.estimatedMinutes ? ` · ~${service.estimatedMinutes} min` : ""}
              </p>
            </div>
            <form action={toggleActiveAction}>
              <input type="hidden" name="serviceId" value={service.id} />
              <input type="hidden" name="isActive" value={(!service.isActive).toString()} />
              <button type="submit" className="rounded border border-gray-300 px-3 py-1 text-xs font-medium">
                {service.isActive ? "Deactivate" : "Activate"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
