import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff-context";
import { listQrCodesForBusiness } from "@/modules/qr/repository";
import { listLocationsForBusiness } from "@/modules/locations/repository";
import { createQr, regenerateQr, setQrStatus } from "@/modules/qr/service";
import { AuthorizationError } from "@/modules/auth/types";
import { NotFoundError } from "@/lib/errors";
import { QrCreateForm } from "./QrCreateForm";
import { RegenerateButton } from "./RegenerateButton";
import type { QrRevealState } from "./types";

export default async function QrManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { businessSlug } = await params;
  const { error } = await searchParams;
  const { business, actor } = await getStaffContext(businessSlug);

  // Route-level guard: the layout only hides the nav link for STAFF, it
  // doesn't block direct navigation. `createQr`/`regenerateQr`/`setQrStatus`
  // all re-check `qr:manage` via `assertAuthorized` regardless, so this is
  // about a clean redirect instead of an uncaught AuthorizationError inside
  // a `useActionState` action, not the actual security boundary.
  if (actor.role !== "BUSINESS_OWNER" && actor.role !== "MANAGER") {
    redirect(`/${businessSlug}/dashboard`);
  }

  const [qrCodes, locations] = await Promise.all([
    listQrCodesForBusiness(business.id),
    listLocationsForBusiness(business.id),
  ]);

  // Both actions below are defined inline so they can close over `actor` and
  // `business.id` — never trusting a business/actor id supplied by the
  // client — and match the `(prevState, formData) => Promise<QrRevealState |
  // null>` signature `useActionState` expects. Neither redirects on success:
  // the raw token/URL must be shown to the staff member inline, once, and a
  // redirect would either lose it or leak it into browser history via the
  // URL.
  async function createQrAction(
    _prevState: QrRevealState | null,
    formData: FormData,
  ): Promise<QrRevealState | null> {
    "use server";
    const locationId = formData.get("locationId");
    const label = formData.get("label");
    if (typeof locationId !== "string" || locationId.length === 0) return null;

    const result = await createQr(actor, {
      locationId,
      label: typeof label === "string" && label.length > 0 ? label : null,
    });
    return { url: result.url, imageDataUrl: result.imageDataUrl };
  }

  async function regenerateQrAction(
    _prevState: QrRevealState | null,
    formData: FormData,
  ): Promise<QrRevealState | null> {
    "use server";
    const qrCodeId = formData.get("qrCodeId");
    if (typeof qrCodeId !== "string") return null;
    return regenerateQr(actor, qrCodeId);
  }

  async function setStatusAction(formData: FormData) {
    "use server";
    const qrCodeId = formData.get("qrCodeId");
    const status = formData.get("status");
    if (typeof qrCodeId !== "string" || (status !== "ACTIVE" && status !== "DISABLED")) return;

    try {
      await setQrStatus(actor, qrCodeId, status);
    } catch (err) {
      const message =
        err instanceof AuthorizationError
          ? "NOT_ALLOWED"
          : err instanceof NotFoundError
            ? "NOT_FOUND"
            : "UNKNOWN";
      redirect(`/${businessSlug}/qr?error=${message}`);
    }
    redirect(`/${businessSlug}/qr`);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">QR codes</h1>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          That action couldn&apos;t be completed ({error}).
        </p>
      )}

      {locations.length === 0 ? (
        <p className="text-sm text-gray-500">
          Create a location first — a QR code always identifies one specific location.
        </p>
      ) : (
        <QrCreateForm action={createQrAction} locations={locations} />
      )}

      <ul className="flex flex-col gap-3">
        {qrCodes.length === 0 && <p className="text-sm text-gray-500">No QR codes yet.</p>}
        {qrCodes.map((qr: (typeof qrCodes)[number]) => (
          <li
            key={qr.id}
            className="flex flex-col gap-3 rounded border border-gray-200 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium">
                {qr.location?.name ?? "Unknown location"}
                {qr.label ? ` · ${qr.label}` : ""}
                <span
                  className={`ml-2 rounded px-2 py-0.5 text-xs ${
                    qr.status === "ACTIVE"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {qr.status}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                {qr.scanCount} scan{qr.scanCount === 1 ? "" : "s"}
                {qr.lastScannedAt
                  ? ` · last scanned ${qr.lastScannedAt.toLocaleString()}`
                  : " · never scanned"}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <RegenerateButton action={regenerateQrAction} qrCodeId={qr.id} />
                <form action={setStatusAction}>
                  <input type="hidden" name="qrCodeId" value={qr.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={qr.status === "ACTIVE" ? "DISABLED" : "ACTIVE"}
                  />
                  <button
                    type="submit"
                    className="rounded border border-gray-300 px-3 py-1 text-xs font-medium"
                  >
                    {qr.status === "ACTIVE" ? "Disable" : "Enable"}
                  </button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
