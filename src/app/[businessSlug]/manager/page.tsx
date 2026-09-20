import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff-context";
import { getDashboardSummary } from "@/modules/analytics/service";

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

export default async function ManagerDashboardPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { actor } = await getStaffContext(businessSlug);

  // Route-level guard mirroring qr/checkin: the layout only hides the nav
  // link for STAFF. `getDashboardSummary` re-checks `business:view_analytics`
  // regardless.
  if (actor.role !== "BUSINESS_OWNER" && actor.role !== "MANAGER") {
    redirect(`/${businessSlug}/dashboard`);
  }

  const summary = await getDashboardSummary(actor);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-lg font-semibold">Manager dashboard</h1>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Today</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Total requests" value={summary.today.total} />
          <StatCard label="New" value={summary.today.new} />
          <StatCard label="Accepted" value={summary.today.accepted} />
          <StatCard label="In progress" value={summary.today.inProgress} />
          <StatCard label="Completed" value={summary.today.completed} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Operational (last 30 days)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Overdue right now" value={summary.overdueCount} />
          <StatCard label="Avg. response time" value={formatMinutes(summary.avgResponseMinutes)} />
          <StatCard label="Avg. completion time" value={formatMinutes(summary.avgCompletionMinutes)} />
          <StatCard
            label="Guest rating"
            value={summary.feedback.averageRating ? summary.feedback.averageRating.toFixed(1) : "—"}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Department performance</h2>
        {summary.departmentPerformance.length === 0 ? (
          <p className="text-sm text-gray-500">No departments yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-500">
              <tr>
                <th className="pb-2">Department</th>
                <th className="pb-2">Requests</th>
                <th className="pb-2">Completed</th>
                <th className="pb-2">Overdue</th>
                <th className="pb-2">Avg. response</th>
                <th className="pb-2">Avg. completion</th>
              </tr>
            </thead>
            <tbody>
              {summary.departmentPerformance.map((dept) => (
                <tr key={dept.id} className="border-t border-gray-100">
                  <td className="py-2 font-medium">{dept.name}</td>
                  <td className="py-2">{dept.total}</td>
                  <td className="py-2">{dept.completed}</td>
                  <td className="py-2">{dept.overdue}</td>
                  <td className="py-2">{formatMinutes(dept.avgResponseMinutes)}</td>
                  <td className="py-2">{formatMinutes(dept.avgCompletionMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Staff workload</h2>
        {summary.staffWorkload.length === 0 ? (
          <p className="text-sm text-gray-500">No staff yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {summary.staffWorkload.map((member) => (
              <li key={member.id} className="flex items-center justify-between border-t border-gray-100 py-2">
                <span>
                  {member.name} <span className="text-xs text-gray-500">({member.role})</span>
                </span>
                <span className="font-medium">{member.activeCount} active</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">
          Recent complaints ({summary.feedback.negativeCount} of {summary.feedback.totalCount} total)
        </h2>
        {summary.recentComplaints.length === 0 ? (
          <p className="text-sm text-gray-500">No negative feedback recently.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {summary.recentComplaints.map((c) => (
              <li key={c.id} className="rounded border border-red-100 bg-red-50 px-3 py-2 text-sm">
                <p className="font-medium text-red-800">
                  {c.rating}★ · {c.guestName}
                </p>
                {c.comment && <p className="text-red-700">{c.comment}</p>}
                <p className="mt-1 text-xs text-red-500">{c.createdAt.toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
