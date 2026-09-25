import Link from "next/link";
import { AlarmClock, ChevronDown, MapPin, User } from "lucide-react";
import { ServiceIcon } from "@/components/guest/ServiceIcon";
import { PriorityMark, StatusBadge } from "@/components/ui/Status";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatDuration, formatTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { RequestStatus } from "@/modules/requests/types";

export interface BoardRequest {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdAt: Date;
  completedAt: Date | null;
  dueAt: Date | null;
  location: { name: string } | null;
  service: { name: string; icon: string | null } | null;
  department: { name: string } | null;
  assignedMembershipId: string | null;
  assignedMembership: { user: { name: string } | null } | null;
  guestStay: { guest: { fullName: string } | null } | null;
}

export interface CardPermissions {
  canReject: boolean;
  canCancel: boolean;
  canAssign: boolean;
}

type Action = "accept" | "start" | "complete" | "reject" | "cancel";

const PRIMARY: Partial<Record<RequestStatus, { action: Action; label: string; pending: string }>> = {
  NEW: { action: "accept", label: "Accept", pending: "Accepting" },
  ACCEPTED: { action: "start", label: "Start", pending: "Starting" },
  IN_PROGRESS: { action: "complete", label: "Mark done", pending: "Completing" },
};

/**
 * One request on the staff board: location first and large (that's where
 * the person is going), then what's needed, then who and how long. The
 * next action is one tap; rarer actions sit behind "More".
 */
export function RequestCard({
  request,
  now,
  timeZone,
  overdueMinutes,
  actorMembershipId,
  permissions,
  team,
  transitionAction,
  assignAction,
}: {
  request: BoardRequest;
  now: Date;
  timeZone: string;
  overdueMinutes: number;
  actorMembershipId: string;
  permissions: CardPermissions;
  team: Array<{ id: string; name: string }>;
  transitionAction: (formData: FormData) => Promise<void>;
  assignAction: (formData: FormData) => Promise<void>;
}) {
  const status = request.status as RequestStatus;
  const primary = PRIMARY[status];
  const open = status === "NEW" || status === "ACCEPTED" || status === "IN_PROGRESS";
  const dueAt = request.dueAt ?? new Date(request.createdAt.getTime() + overdueMinutes * 60_000);
  const lateBy = open ? Math.round((now.getTime() - dueAt.getTime()) / 60_000) : 0;
  const mine = request.assignedMembershipId === actorMembershipId;

  const secondary: Array<{ action: Action; label: string }> = [];
  if (status === "NEW" && permissions.canReject) secondary.push({ action: "reject", label: "Decline" });
  if (open && permissions.canCancel) secondary.push({ action: "cancel", label: "Cancel request" });

  return (
    <article
      className={cn(
        "rounded-[var(--radius-panel)] border bg-surface p-4 shadow-[var(--shadow-panel)]",
        lateBy > 0 ? "border-danger/40" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 text-[17px] font-extrabold text-ink">
          <MapPin className="size-4 shrink-0 text-brass-500" aria-hidden />
          <span className="truncate">{request.location?.name ?? "Unknown location"}</span>
        </p>
        <span className="shrink-0 text-xs font-semibold text-ink-faint tabular" title={formatTime(request.createdAt, timeZone)}>
          {timeAgo(request.createdAt, now)}
        </span>
      </div>

      <div className="mt-2.5 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lagoon-50 text-lagoon-700">
          <ServiceIcon icon={request.service?.icon} name={request.service?.name ?? request.title} className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="font-bold leading-snug text-ink">{request.title}</p>
          {request.description && <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{request.description}</p>}
          <p className="mt-1 text-[13px] text-ink-faint">
            {[request.service?.name !== request.title ? request.service?.name : null, request.department?.name, request.guestStay?.guest?.fullName]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={status} />
        <PriorityMark priority={request.priority} />
        {lateBy > 0 && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-danger-bg px-2.5 text-xs font-bold text-danger">
            <AlarmClock className="size-3.5" aria-hidden />
            Late by {formatDuration(lateBy)}
          </span>
        )}
        {request.assignedMembership?.user?.name && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-sunken px-2.5 text-xs font-semibold text-ink-soft">
            <User className="size-3.5" aria-hidden />
            {mine ? "You" : request.assignedMembership.user.name}
          </span>
        )}
      </div>

      {open && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {primary && (
            <form action={transitionAction} className="flex-1">
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="action" value={primary.action} />
              <SubmitButton block pendingLabel={primary.pending}>
                {primary.label}
              </SubmitButton>
            </form>
          )}
          {(secondary.length > 0 || permissions.canAssign) && (
            <details className="group relative">
              <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-1 rounded-[var(--radius-control)] border border-line-strong px-3 text-sm font-semibold text-ink-soft hover:bg-sunken [&::-webkit-details-marker]:hidden">
                More
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-[var(--radius-panel)] border border-line bg-surface p-3 shadow-[var(--shadow-lift)]">
                {permissions.canAssign && (
                  <form action={assignAction} className="flex flex-col gap-2 border-b border-line pb-3">
                    <input type="hidden" name="requestId" value={request.id} />
                    <label htmlFor={`assign-${request.id}`} className="text-xs font-semibold text-ink-soft">
                      Assign to
                    </label>
                    <div className="flex gap-2">
                      <select
                        id={`assign-${request.id}`}
                        name="membershipId"
                        defaultValue={request.assignedMembershipId ?? ""}
                        className="h-9 min-w-0 flex-1 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 text-sm"
                      >
                        <option value="">Nobody</option>
                        {team.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      <SubmitButton size="sm" variant="secondary" pendingLabel="Saving">
                        Save
                      </SubmitButton>
                    </div>
                  </form>
                )}
                {secondary.map(({ action, label }) => (
                  <form action={transitionAction} key={action} className="mt-2">
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="action" value={action} />
                    <SubmitButton variant="ghost" size="sm" block className="justify-start text-danger">
                      {label}
                    </SubmitButton>
                  </form>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {!open && request.completedAt && (
        <p className="mt-3 text-xs text-ink-faint">
          Finished at {formatTime(request.completedAt, timeZone)}, {formatDuration((request.completedAt.getTime() - request.createdAt.getTime()) / 60_000)} after it was made.
        </p>
      )}
    </article>
  );
}

export function BoardTabs({ tabs }: { tabs: Array<{ href: string; label: string; active: boolean; count?: number }> }) {
  return (
    <nav className="flex gap-1 rounded-[var(--radius-control)] bg-sunken p-1" aria-label="Request views">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-sm font-semibold",
            tab.active ? "bg-surface text-ink shadow-[var(--shadow-panel)]" : "text-ink-soft hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count !== undefined && <span className="text-xs text-ink-faint tabular">{tab.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
