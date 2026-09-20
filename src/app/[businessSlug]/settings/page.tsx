import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff-context";
import { updateBusinessCore, updateBusinessSettings } from "@/modules/business/service";
import { AuthorizationError } from "@/modules/auth/types";
import { ValidationError } from "@/lib/errors";

export default async function BusinessSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { businessSlug } = await params;
  const { error, saved } = await searchParams;
  const { business, actor } = await getStaffContext(businessSlug);

  // Route-level guard mirroring qr/checkin/manager: the layout only hides
  // the nav link for STAFF. Both service functions re-check
  // `business:update_settings` regardless.
  if (actor.role !== "BUSINESS_OWNER" && actor.role !== "MANAGER") {
    redirect(`/${businessSlug}/dashboard`);
  }

  async function saveSettings(formData: FormData) {
    "use server";

    const name = formData.get("name");
    const timezone = formData.get("timezone");
    const currency = formData.get("currency");
    const contactEmail = formData.get("contactEmail");
    const phone = formData.get("phone");
    const address = formData.get("address");
    const website = formData.get("website");
    const welcomeMessage = formData.get("welcomeMessage");
    const primaryColor = formData.get("primaryColor");
    const description = formData.get("description");

    const asStringOrNull = (v: FormDataEntryValue | null) =>
      typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

    try {
      await updateBusinessCore(actor, {
        name: typeof name === "string" ? name : undefined,
        timezone: typeof timezone === "string" && timezone ? timezone : undefined,
        currency: typeof currency === "string" && currency ? currency : undefined,
      });
      await updateBusinessSettings(actor, {
        contactEmail: asStringOrNull(contactEmail),
        phone: asStringOrNull(phone),
        address: asStringOrNull(address),
        website: asStringOrNull(website),
        welcomeMessage: asStringOrNull(welcomeMessage),
        primaryColor: asStringOrNull(primaryColor),
        description: asStringOrNull(description),
      });
    } catch (err) {
      const message =
        err instanceof AuthorizationError
          ? "NOT_ALLOWED"
          : err instanceof ValidationError
            ? encodeURIComponent(err.message)
            : "UNKNOWN";
      redirect(`/${businessSlug}/settings?error=${message}`);
    }

    redirect(`/${businessSlug}/settings?saved=1`);
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">Business settings</h1>

      {saved && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">Settings saved.</p>
      )}
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error === "NOT_ALLOWED"
            ? "You don't have permission to change these settings."
            : error === "UNKNOWN"
              ? "Something went wrong — please try again."
              : decodeURIComponent(error)}
        </p>
      )}

      <form action={saveSettings} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-3 rounded border border-gray-200 p-3">
          <legend className="px-1 text-xs font-semibold text-gray-500">Identity</legend>
          <label className="flex flex-col gap-1 text-xs">
            Business name
            <input
              name="name"
              defaultValue={business.name}
              required
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-xs">
              Timezone
              <input
                name="timezone"
                defaultValue={business.timezone}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs">
              Currency
              <input
                name="currency"
                defaultValue={business.currency}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded border border-gray-200 p-3">
          <legend className="px-1 text-xs font-semibold text-gray-500">Contact & branding</legend>
          <label className="flex flex-col gap-1 text-xs">
            Contact email
            <input
              name="contactEmail"
              type="email"
              defaultValue={business.settings?.contactEmail ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Phone
            <input
              name="phone"
              defaultValue={business.settings?.phone ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Address
            <input
              name="address"
              defaultValue={business.settings?.address ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Website
            <input
              name="website"
              defaultValue={business.settings?.website ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Primary color
            <input
              name="primaryColor"
              type="text"
              placeholder="#000000"
              defaultValue={business.settings?.primaryColor ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Guest welcome message
            <textarea
              name="welcomeMessage"
              rows={2}
              defaultValue={business.settings?.welcomeMessage ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Description
            <textarea
              name="description"
              rows={3}
              defaultValue={business.settings?.description ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </fieldset>

        <button
          type="submit"
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
        >
          Save settings
        </button>
      </form>
    </div>
  );
}
