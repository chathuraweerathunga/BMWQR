import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff-context";
import { listDepartmentsForBusiness } from "@/modules/departments/repository";
import { createDepartment } from "@/modules/departments/service";
import { AuthorizationError } from "@/modules/auth/types";
import { ValidationError } from "@/lib/errors";

export default async function DepartmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { businessSlug } = await params;
  const { error } = await searchParams;
  const { business, actor } = await getStaffContext(businessSlug);

  // Route-level guard mirroring qr/checkin/manager/settings: the layout
  // only hides the nav link for STAFF. `createDepartment` re-checks
  // `department:manage` regardless.
  if (actor.role !== "BUSINESS_OWNER" && actor.role !== "MANAGER") {
    redirect(`/${businessSlug}/dashboard`);
  }

  const departments = await listDepartmentsForBusiness(business.id);

  async function createAction(formData: FormData) {
    "use server";
    const name = formData.get("name");
    const description = formData.get("description");
    if (typeof name !== "string" || !name.trim()) {
      redirect(`/${businessSlug}/departments?error=${encodeURIComponent("Department name is required.")}`);
    }

    try {
      await createDepartment(actor, {
        name: name as string,
        description: typeof description === "string" && description.trim() ? description : null,
      });
    } catch (err) {
      const message =
        err instanceof AuthorizationError
          ? "You don't have permission to manage departments."
          : err instanceof ValidationError
            ? err.message
            : "Something went wrong — please try again.";
      redirect(`/${businessSlug}/departments?error=${encodeURIComponent(message)}`);
    }
    redirect(`/${businessSlug}/departments`);
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">Departments</h1>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {decodeURIComponent(error)}
        </p>
      )}

      <form action={createAction} className="flex flex-col gap-2 rounded border border-gray-200 p-4">
        <h2 className="text-sm font-semibold">New department</h2>
        <input
          name="name"
          placeholder="e.g. Housekeeping"
          required
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          name="description"
          placeholder="Description (optional)"
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="self-start rounded bg-black px-3 py-1.5 text-xs font-medium text-white"
        >
          Add department
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {departments.length === 0 && (
          <p className="text-sm text-gray-500">No departments yet.</p>
        )}
        {departments.map((dept: (typeof departments)[number]) => (
          <li key={dept.id} className="rounded border border-gray-200 px-4 py-3">
            <p className="text-sm font-medium">{dept.name}</p>
            {dept.description && <p className="text-xs text-gray-500">{dept.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
