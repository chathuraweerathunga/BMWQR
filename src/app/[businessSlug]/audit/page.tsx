import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { getStaffContext } from "@/lib/staff-context";
import { permissionsForActor } from "@/modules/auth/permissions";
import { getAuditLogForBusiness } from "@/modules/audit/service";
import { formatDateTime } from "@/lib/format";
import { EmptyState, PageHeader, Panel } from "@/components/ui/Layout";
import { BoardTabs } from "@/components/app/RequestCard";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Audit log" };

const PAGE = 50;

const DESCRIBE: Record<string, (v: Record<string, unknown> | null) => string> = {
  "business.signed_up": () => "Created the workspace",
  "business.core_updated": () => "Changed property details",
  "business.settings_updated": () => "Changed guest portal or contact settings",
  "department.created": (v) => `Added department ${v?.name ?? ""}`.trim(),
  "department.updated": (v) => `Edited department ${v?.name ?? ""}`.trim(),
  "location.created": (v) => `Added location ${v?.name ?? ""}`.trim(),
  "location.bulk_created": (v) => `Added ${v?.created ?? "several"} locations`,
  "location.status_changed": (v) => `Set a location to ${String(v?.status ?? "").toLowerCase()}`,
  "service.created": (v) => `Added service ${v?.name ?? ""}`.trim(),
  "service.updated": (v) => `Edited service ${v?.name ?? ""}`.trim(),
  "service.activated": () => "Showed a service to guests",
  "service.deactivated": () => "Hid a service from guests",
  "qr.created": () => "Created a QR code",
  "qr.bulk_created": (v) => `Created ${v?.count ?? "several"} QR codes`,
  "qr.regenerated": () => "Replaced a QR code",
  "qr.enabled": () => "Enabled a QR code",
  "qr.disabled": () => "Disabled a QR code",
  "guest_stay.checked_in": () => "Checked a guest in",
  "guest_stay.checked_out": () => "Checked a guest out",
  "request.status_changed": (v) => `Moved a request to ${String(v?.status ?? "").toLowerCase().replace("_", " ")}`,
  "request.assigned": (v) => (v?.assignedMembershipId ? "Assigned a request" : "Unassigned a request"),
  "staff.invited": (v) => `Added ${v?.email ?? "a team member"} as ${String(v?.role ?? "").toLowerCase().replace("business_", "")}`,
  "staff.disabled": () => "Removed a team member's access",
  "staff.enabled": () => "Restored a team member's access",
};

const FILTERS = [
  { key: "", label: "Everything" },
  { key: "request.", label: "Requests" },
  { key: "guest_stay.", label: "Guests" },
  { key: "staff.", label: "Team" },
  { key: "qr.", label: "QR codes" },
];

export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ before?: string; type?: string }>;
}) {
  const { businessSlug } = await params;
  const { before, type } = await searchParams;
  const { business, actor } = await getStaffContext(businessSlug);
  if (!permissionsForActor(actor).has("business:view_audit_log")) redirect(`/${businessSlug}/dashboard`);

  const filter = FILTERS.find((f) => f.key && f.key === type)?.key ?? "";
  const beforeDate = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : undefined;
  const entries = await getAuditLogForBusiness(actor, { limit: PAGE, before: beforeDate, actionPrefix: filter || undefined });
  const base = `/${businessSlug}/audit`;
  const withType = (extra = "") => `${base}?${filter ? `type=${encodeURIComponent(filter)}&` : ""}${extra}`;

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who did what, and when. Entries can't be edited or deleted."
        actions={
          <BoardTabs
            tabs={FILTERS.map((f) => ({
              href: f.key ? `${base}?type=${encodeURIComponent(f.key)}` : base,
              label: f.label,
              active: f.key === filter,
            }))}
          />
        }
      />

      {entries.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-6" />} title={beforeDate ? "No older entries" : "Nothing recorded yet"}>
          Changes to rooms, services, the team and requests are recorded here.
        </EmptyState>
      ) : (
        <Panel className="overflow-hidden">
          <ol className="divide-y divide-line">
            {entries.map(
              (e: {
                id: string;
                action: string;
                actorType: string;
                createdAt: Date;
                ipAddress: string | null;
                newValue: unknown;
                actorUser: { name: string } | null;
              }) => {
                const describe = DESCRIBE[e.action];
                const text = describe ? describe((e.newValue ?? null) as Record<string, unknown> | null) : e.action;
                const who = e.actorUser?.name ?? (e.actorType === "guest" ? "A guest" : e.actorType === "system" ? "OneWeb (automatic)" : "Someone");
                return (
                  <li key={e.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[160px_1fr_auto] sm:items-baseline sm:gap-4">
                    <time className="text-[13px] text-ink-faint tabular" dateTime={e.createdAt.toISOString()}>
                      {formatDateTime(e.createdAt, business.timezone)}
                    </time>
                    <p className="text-sm">
                      <span className="font-bold">{who}</span> <span className="text-ink-soft">{text.charAt(0).toLowerCase() + text.slice(1)}</span>
                    </p>
                    {e.ipAddress && <p className="text-xs text-ink-faint tabular">{e.ipAddress}</p>}
                  </li>
                );
              },
            )}
          </ol>
        </Panel>
      )}

      <div className="mt-4 flex gap-2">
        {beforeDate && (
          <Link href={withType()} className="inline-flex h-10 items-center px-3 text-sm font-semibold text-lagoon-700 hover:underline">
            Back to newest
          </Link>
        )}
        {entries.length === PAGE && (
          <ButtonLink variant="secondary" href={withType(`before=${encodeURIComponent(entries[entries.length - 1].createdAt.toISOString())}`)}>
            Older entries
          </ButtonLink>
        )}
      </div>
    </>
  );
}
