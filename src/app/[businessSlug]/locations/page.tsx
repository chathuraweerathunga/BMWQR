import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff-context";
import { listLocationsForBusiness } from "@/modules/locations/repository";
import { createLocation, setLocationStatus } from "@/modules/locations/service";
import { LOCATION_TYPES, type LocationType, type LocationStatus } from "@/modules/locations/types";
import { AuthorizationError } from "@/modules/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";

export default async function LocationsPage({
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
  // only hides the nav link for STAFF. `createLocation`/`setLocationStatus`
  // re-check `location:manage` regardless.
  if (actor.role !== "BUSINESS_OWNER" && actor.role !== "MANAGER") {
    redirect(`/${businessSlug}/dashboard`);
  }

  const locations = await listLocationsForBusiness(business.id);

  async function createAction(formData: FormData) {
    "use server";
    const name = formData.get("name");
    const type = formData.get("type");
    const parentLocationId = formData.get("parentLocationId");
    const description = formData.get("description");

    if (typeof name !== "string" || !name.trim() || typeof type !== "string") {
      redirect(`/${businessSlug}/locations?error=${encodeURIComponent("Name and type are required.")}`);
    }

    try {
      await createLocation(actor, {
        name: name as string,
        type: type as LocationType,
        parentLocationId:
          typeof parentLocationId === "string" && parentLocationId ? parentLocationId : null,
        description: typeof description === "string" && description.trim() ? description : null,
      });
    } catch (err) {
      const message =
        err instanceof AuthorizationError
          ? "You don't have permission to manage locations."
          : err instanceof ValidationError || err instanceof NotFoundError
            ? err.message
            : "Something went wrong — please try again.";
      redirect(`/${businessSlug}/locations?error=${encodeURIComponent(message)}`);
    }
    redirect(`/${businessSlug}/locations`);
  }

  async function setStatusAction(formData: FormData) {
    "use server";
    const locationId = formData.get("locationId");
    const status = formData.get("status");
    if (typeof locationId !== "string" || typeof status !== "string") return;

    try {
      await setLocationStatus(actor, locationId, status as LocationStatus);
    } catch (err) {
      const message =
        err instanceof AuthorizationError ? "NOT_ALLOWED" : err instanceof NotFoundError ? "NOT_FOUND" : "UNKNOWN";
      redirect(`/${businessSlug}/locations?error=${message}`);
    }
    redirect(`/${businessSlug}/locations`);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">Locations</h1>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{decodeURIComponent(error)}</p>
      )}

      <form action={createAction} className="flex flex-col gap-2 rounded border border-gray-200 p-4">
        <h2 className="text-sm font-semibold">New location</h2>
        <div className="flex flex-wrap gap-2">
          <input
            name="name"
            placeholder="e.g. Room 208"
            required
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <select name="type" required className="rounded border border-gray-300 px-3 py-2 text-sm">
            {LOCATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace("_", " ")}
              </option>
            ))}
          </select>
          <select name="parentLocationId" className="rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">No parent</option>
            {locations.map((loc: (typeof locations)[number]) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
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
          Add location
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {locations.length === 0 && <p className="text-sm text-gray-500">No locations yet.</p>}
        {locations.map((loc: (typeof locations)[number]) => {
          const parent = locations.find((l: (typeof locations)[number]) => l.id === loc.parentLocationId);
          return (
            <li
              key={loc.id}
              className="flex items-center justify-between rounded border border-gray-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {loc.name}
                  <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {loc.type}
                  </span>
                  <span
                    className={`ml-2 rounded px-2 py-0.5 text-xs ${
                      loc.status === "ACTIVE"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {loc.status}
                  </span>
                </p>
                {parent && <p className="text-xs text-gray-500">Under {parent.name}</p>}
              </div>
              <form action={setStatusAction}>
                <input type="hidden" name="locationId" value={loc.id} />
                <input
                  type="hidden"
                  name="status"
                  value={loc.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"}
                />
                <button type="submit" className="rounded border border-gray-300 px-3 py-1 text-xs font-medium">
                  {loc.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
