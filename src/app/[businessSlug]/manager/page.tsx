import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlarmClock, MessageSquareWarning, Star } from "lucide-react";
import { getStaffContext } from "@/lib/staff-context";
import { permissionsForActor } from "@/modules/auth/permissions";
import { getDashboardSummary } from "@/modules/analytics/service";
import { formatDateTime, formatDuration } from "@/lib/format";
import { Avatar, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/Layout";
import { ButtonLink } from "@/components/ui/Button";
import { LiveRefresh } from "@/components/ui/LiveRefresh";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Overview" };

const ROLE_LABEL: Record<string, string> = { BUSINESS_OWNER: "Owner", MANAGER: "Manager", STAFF: "Staff" };

function Tile({
  label,
  value,
  tone = "plain",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "plain" | "alert";
  hint?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-panel)] border p-4",
        tone === "alert" ? "border-danger/30 bg-danger-bg" : "border-line bg-surface",
      )}
    >
      <p className={cn("flex items-center gap-1.5 text-sm font-semibold", tone === "alert" ? "text-danger" : "text-ink-soft")}>
        {tone === "alert" && <AlarmClock className="size-4" aria-hidden />}
        {label}
      </p>
      <p className={cn("mt-1 text-[32px] font-extrabold leading-none tabular", tone === "alert" ? "text-danger" : "text-ink")}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

/** Seven vertical bars, one hue, value on each bar: a week at a glance. */
function VolumeChart({ days }: { days: Array<{ date: string; label: string; count: number }> }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <figure>
      <div className="flex h-44 items-end gap-2 border-b border-line-strong" role="img" aria-label="Requests per day, last 7 days">
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          return (
            <div key={d.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${d.count} requests`}>
              <span className="text-xs font-bold text-ink tabular">{d.count}</span>
              <div
                className={cn(
                  "w-full max-w-10 rounded-t-[4px] transition-colors",
                  isToday ? "bg-lagoon-700" : "bg-lagoon-200 group-hover:bg-lagoon-500",
                )}
                style={{ height: `${Math.max(d.count ? 4 : 0, (d.count / max) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {days.map((d, i) => (
          <span key={d.date} className={cn("flex-1 text-center text-xs", i === days.length - 1 ? "font-bold text-ink" : "text-ink-faint")}>
            {i === days.length - 1 ? "Today" : d.label}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        {days.map((d) => `${d.label}: ${d.count}`).join(", ")}
      </figcaption>
    </figure>
  );
}

function RankBars({ rows, unit }: { rows: Array<{ name: string; count: number }>; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.name} title={`${r.name}: ${r.count} ${unit}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-semibold text-ink">{r.name}</span>
            <span className="shrink-0 font-bold text-ink tabular">{r.count}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-sunken">
            <div className="h-2 rounded-full bg-lagoon-600" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ManagerOverviewPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  const { business, actor } = await getStaffContext(businessSlug);
  if (!permissionsForActor(actor).has("business:view_analytics")) redirect(`/${businessSlug}/dashboard`);

  const s = await getDashboardSummary(actor, business.timezone);
  const inProgress = s.today.accepted + s.today.inProgress;
  const busiest = Math.max(1, ...s.staffWorkload.map((m) => m.activeCount));

  return (
    <>
      <LiveRefresh intervalMs={30_000} />
      <PageHeader
        title="Overview"
        description="What's happening across the property right now, and how the last 30 days went."
        actions={<ButtonLink href={`/${businessSlug}/dashboard`} variant="secondary">Open requests board</ButtonLink>}
      />

      <section aria-label="Today" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Waiting" value={s.today.new} hint="New today, not yet accepted" />
        <Tile label="Being handled" value={inProgress} hint="Accepted or in progress" />
        <Tile
          label="Overdue"
          value={s.overdueCount}
          tone={s.overdueCount > 0 ? "alert" : "plain"}
          hint={s.overdueCount > 0 ? "Open past their expected time" : "Nothing late"}
        />
        <Tile label="Done today" value={s.today.completed} hint={`of ${s.today.total} made today`} />
      </section>

      <section aria-label="Last 30 days" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Average time to accept" value={formatDuration(s.avgResponseMinutes)} hint="Last 30 days" />
        <Tile label="Average time to finish" value={formatDuration(s.avgCompletionMinutes)} hint="Last 30 days" />
        <Tile
          label="Guest rating"
          value={s.feedback.averageRating ? `${s.feedback.averageRating.toFixed(1)} / 5` : "—"}
          hint={`${s.feedback.totalCount} rating${s.feedback.totalCount === 1 ? "" : "s"}`}
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHeader title="Requests per day" description="Last 7 days, property time" />
          <div className="p-5">
            <VolumeChart days={s.dailyVolume} />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Most requested" description="Last 30 days" />
          <div className="p-5">
            {s.topServices.length ? (
              <RankBars rows={s.topServices} unit="requests" />
            ) : (
              <p className="text-sm text-ink-faint">No requests in the last 30 days.</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel className="mt-6 overflow-hidden">
        <PanelHeader title="Departments" description="Last 30 days. Overdue counts what is late right now." />
        {s.departmentPerformance.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No departments yet" action={<ButtonLink href={`/${businessSlug}/departments`}>Add departments</ButtonLink>}>
              Departments route requests to the right team.
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-faint">
                  <th scope="col" className="px-5 py-3 font-semibold">Department</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Requests</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Done</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Overdue</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Time to accept</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Time to finish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {s.departmentPerformance.map((d) => (
                  <tr key={d.id} className="hover:bg-paper">
                    <th scope="row" className="px-5 py-3 font-bold text-ink">{d.name}</th>
                    <td className="px-3 py-3 text-right tabular">{d.total}</td>
                    <td className="px-3 py-3 text-right tabular">{d.completed}</td>
                    <td className={cn("px-3 py-3 text-right font-semibold tabular", d.overdue > 0 ? "text-danger" : "text-ink-faint")}>
                      {d.overdue}
                    </td>
                    <td className="px-3 py-3 text-right tabular">{formatDuration(d.avgResponseMinutes)}</td>
                    <td className="px-5 py-3 text-right tabular">{formatDuration(d.avgCompletionMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Team workload" description="Open requests assigned to each person" />
          <ul className="flex flex-col gap-4 p-5">
            {s.staffWorkload.length === 0 && <li className="text-sm text-ink-faint">No team members yet.</li>}
            {[...s.staffWorkload]
              .sort((a, b) => b.activeCount - a.activeCount)
              .map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <Avatar name={m.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-semibold">
                        {m.name} <span className="font-normal text-ink-faint">{ROLE_LABEL[m.role] ?? m.role}</span>
                      </span>
                      <span className="font-bold tabular">{m.activeCount}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-sunken">
                      <div className="h-1.5 rounded-full bg-brass-500" style={{ width: `${(m.activeCount / busiest) * 100}%` }} />
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader
            title="Recent complaints"
            description={`${s.feedback.negativeCount} low ratings out of ${s.feedback.totalCount}`}
          />
          {s.recentComplaints.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Star className="size-6" />} title="No low ratings">
                Ratings of 1 or 2 stars show here so you can follow up.
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {s.recentComplaints.map((c) => (
                <li key={c.id} className="flex gap-3 px-5 py-4">
                  <MessageSquareWarning className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      {c.rating} of 5 from {c.guestName}
                    </p>
                    {c.comment && <p className="mt-0.5 text-sm text-ink-soft">{c.comment}</p>}
                    <p className="mt-1 text-xs text-ink-faint">{formatDateTime(c.createdAt, business.timezone)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
