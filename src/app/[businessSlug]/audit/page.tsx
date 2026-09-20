import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff-context";
import { getAuditLogForBusiness } from "@/modules/audit/service";

export default async function AuditLogPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { actor } = await getStaffContext(businessSlug);

  // Route-level guard mirroring the other management pages: the layout
  // only hides the nav link for STAFF. `getAuditLogForBusiness` re-checks
  // `business:view_audit_log` regardless.
  if (actor.role !== "BUSINESS_OWNER" && actor.role !== "MANAGER") {
    redirect(`/${businessSlug}/dashboard`);
  }

  const entries = await getAuditLogForBusiness(actor, { limit: 100 });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Audit log</h1>
        <p className="text-sm text-gray-500">The most recent 100 recorded actions.</p>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No audit entries yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-gray-500">
            <tr>
              <th className="pb-2">When</th>
              <th className="pb-2">Action</th>
              <th className="pb-2">Entity</th>
              <th className="pb-2">Actor</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry: (typeof entries)[number]) => (
              <tr key={entry.id} className="border-t border-gray-100 align-top">
                <td className="py-2 whitespace-nowrap text-xs text-gray-500">
                  {entry.createdAt.toLocaleString()}
                </td>
                <td className="py-2 font-mono text-xs">{entry.action}</td>
                <td className="py-2 text-xs text-gray-600">
                  {entry.entityType}
                  {entry.entityId ? ` (${entry.entityId.slice(0, 8)}…)` : ""}
                </td>
                <td className="py-2 text-xs text-gray-600">{entry.actorType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
