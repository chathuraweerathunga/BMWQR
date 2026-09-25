import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { QrCode } from "lucide-react";
import { getStaffContext } from "@/lib/staff-context";
import { permissionsForActor } from "@/modules/auth/permissions";
import { listQrCodesForBusiness } from "@/modules/qr/repository";
import { listLocationsForBusiness } from "@/modules/locations/repository";
import { createQr, createQrForUncoveredLocations, NO_QR_BY_DEFAULT, regenerateQr, setQrStatus } from "@/modules/qr/service";
import { runAction, textField } from "@/lib/actions";
import { formatDateTime, timeAgo } from "@/lib/format";
import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/Layout";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { cn } from "@/lib/cn";
import { QrWorkbench, ReplaceCodeButton } from "./QrWorkbench";
import type { QrRevealState } from "./types";

export const metadata: Metadata = { title: "QR codes" };

export default async function QrManagementPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  const { business, actor } = await getStaffContext(businessSlug);
  if (!permissionsForActor(actor).has("qr:manage")) redirect(`/${businessSlug}/dashboard`);

  const [qrCodes, locations] = await Promise.all([
    listQrCodesForBusiness(business.id),
    listLocationsForBusiness(business.id),
  ]);
  const path = `/${businessSlug}/qr`;
  const active = locations.filter((l: { status: string }) => l.status === "ACTIVE") as Array<{ id: string; name: string; type: string }>;
  const covered = new Set(
    qrCodes.filter((q: { status: string }) => q.status === "ACTIVE").map((q: { locationId: string }) => q.locationId),
  );
  const uncoveredCount = active.filter((l) => !covered.has(l.id) && !NO_QR_BY_DEFAULT.has(l.type)).length;
  const natural = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true });

  // These return the new codes in the action's response and never redirect:
  // the raw token must not end up in a URL or browser history.
  async function createOne(_prev: QrRevealState, formData: FormData): Promise<QrRevealState> {
    "use server";
    const locationId = textField(formData, "locationId");
    let reveal: QrRevealState = { codes: [] };
    const result = await runAction("qr.create", async () => {
      if (!locationId) throw new Error("missing location");
      const qr = await createQr(actor, { locationId, label: textField(formData, "label") });
      const name = active.find((l) => l.id === locationId)?.name ?? "Location";
      reveal = { codes: [{ locationName: name, url: qr.url, imageDataUrl: qr.imageDataUrl }] };
    });
    revalidatePath(path);
    return result.error ? { codes: [], error: result.error } : reveal;
  }

  async function createAll(): Promise<QrRevealState> {
    "use server";
    let codes: QrRevealState["codes"] = [];
    const result = await runAction("qr.bulk", async () => {
      codes = await createQrForUncoveredLocations(actor);
    });
    revalidatePath(path);
    return result.error ? { codes: [], error: result.error } : { codes };
  }

  async function regenerate(_prev: QrRevealState, formData: FormData): Promise<QrRevealState> {
    "use server";
    const qrCodeId = textField(formData, "qrCodeId");
    const row = qrCodes.find((q: { id: string }) => q.id === qrCodeId);
    let reveal: QrRevealState = { codes: [] };
    const result = await runAction("qr.regenerate", async () => {
      if (!qrCodeId) throw new Error("missing code");
      const qr = await regenerateQr(actor, qrCodeId);
      const name = row?.location?.name ?? "Location";
      reveal = {
        codes: [{ locationName: name, url: qr.url, imageDataUrl: qr.imageDataUrl }],
        message: `New code for ${name}. The old printed code no longer works.`,
      };
    });
    revalidatePath(path);
    return result.error ? { codes: [], error: result.error } : reveal;
  }

  async function setStatus(formData: FormData) {
    "use server";
    const qrCodeId = textField(formData, "qrCodeId");
    const status = textField(formData, "status");
    if (!qrCodeId || (status !== "ACTIVE" && status !== "DISABLED")) return;
    await runAction("qr.status", async () => {
      await setQrStatus(actor, qrCodeId, status);
    });
    revalidatePath(path);
  }

  const rows = [...qrCodes].sort((a: { location: { name: string } | null }, b: { location: { name: string } | null }) =>
    natural({ name: a.location?.name ?? "" }, { name: b.location?.name ?? "" }),
  );

  const existing = (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Codes in use"
        description="A code only identifies the location. Guests still need an active stay to send requests."
      />
      {rows.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={<QrCode className="size-6" />} title="No QR codes yet">
            {active.length ? "Create codes for your rooms above, then print and place them." : "Add locations first. Each code points to one location."}
          </EmptyState>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map(
            (qr: {
              id: string;
              status: string;
              label: string | null;
              scanCount: number;
              lastScannedAt: Date | null;
              location: { name: string } | null;
            }) => (
              <li key={qr.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3", qr.status !== "ACTIVE" && "bg-paper")}>
                <QrCode className={cn("size-5 shrink-0", qr.status === "ACTIVE" ? "text-lagoon-700" : "text-ink-faint")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-bold", qr.status !== "ACTIVE" && "text-ink-faint")}>
                    {qr.location?.name ?? "Unknown location"}
                    {qr.label && qr.label !== qr.location?.name && <span className="ml-1.5 font-normal text-ink-faint">{qr.label}</span>}
                    {qr.status !== "ACTIVE" && <span className="ml-2 text-xs font-semibold text-danger">Disabled</span>}
                  </p>
                  <p className="text-[13px] text-ink-faint" title={qr.lastScannedAt ? formatDateTime(qr.lastScannedAt, business.timezone) : undefined}>
                    {qr.scanCount} scan{qr.scanCount === 1 ? "" : "s"}
                    {qr.lastScannedAt ? `, last ${timeAgo(qr.lastScannedAt)}` : ", not scanned yet"}
                  </p>
                </div>
                <ReplaceCodeButton qrCodeId={qr.id} locationName={qr.location?.name ?? "this location"} />
                <form action={setStatus}>
                  <input type="hidden" name="qrCodeId" value={qr.id} />
                  <input type="hidden" name="status" value={qr.status === "ACTIVE" ? "DISABLED" : "ACTIVE"} />
                  <SubmitButton variant={qr.status === "ACTIVE" ? "ghost" : "secondary"} size="sm" pendingLabel="Saving">
                    {qr.status === "ACTIVE" ? "Disable" : "Enable"}
                  </SubmitButton>
                </form>
              </li>
            ),
          )}
        </ul>
      )}
    </Panel>
  );

  return (
    <>
      <PageHeader
        title="QR codes"
        description="Place a code in each room and area. Scanning it tells the team where the guest is."
      />
      <QrWorkbench
        createOne={createOne}
        createAll={createAll}
        regenerate={regenerate}
        locations={[...active].sort(natural)}
        uncoveredCount={uncoveredCount}
        businessName={business.name}
        existing={existing}
      />
    </>
  );
}
