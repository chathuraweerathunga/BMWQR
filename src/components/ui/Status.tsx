import { cn } from "@/lib/cn";
import type { RequestStatus } from "@/modules/requests/types";

export const STATUS_LABEL: Record<RequestStatus, string> = {
  NEW: "New",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CLOSED: "Closed",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
};

/** What the guest sees for each status: plain words, from their side. */
export const GUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  NEW: "Received",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "On the way",
  COMPLETED: "Done",
  CLOSED: "Done",
  REJECTED: "Couldn't be fulfilled",
  CANCELLED: "Cancelled",
};

const STATUS_STYLE: Record<RequestStatus, string> = {
  NEW: "bg-st-new-bg text-st-new",
  ACCEPTED: "bg-st-accepted-bg text-st-accepted",
  IN_PROGRESS: "bg-st-progress-bg text-st-progress",
  COMPLETED: "bg-st-done-bg text-st-done",
  CLOSED: "bg-st-done-bg text-st-done",
  REJECTED: "bg-st-stopped-bg text-st-stopped",
  CANCELLED: "bg-st-stopped-bg text-st-stopped",
};

export const STATUS_DOT: Record<RequestStatus, string> = {
  NEW: "bg-st-new",
  ACCEPTED: "bg-st-accepted",
  IN_PROGRESS: "bg-st-progress",
  COMPLETED: "bg-st-done",
  CLOSED: "bg-st-done",
  REJECTED: "bg-st-stopped",
  CANCELLED: "bg-st-stopped",
};

export function StatusBadge({
  status,
  audience = "staff",
  className,
}: {
  status: RequestStatus;
  audience?: "staff" | "guest";
  className?: string;
}) {
  const label = audience === "guest" ? GUEST_STATUS_LABEL[status] : STATUS_LABEL[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold",
        STATUS_STYLE[status],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
      {label}
    </span>
  );
}

type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

/** Only HIGH and URGENT get a visible mark; everyday requests stay quiet. */
export function PriorityMark({ priority }: { priority: Priority | string }) {
  if (priority === "URGENT") {
    return (
      <span className="inline-flex h-6 items-center rounded-full bg-danger px-2.5 text-xs font-bold text-white">
        Urgent
      </span>
    );
  }
  if (priority === "HIGH") {
    return (
      <span className="inline-flex h-6 items-center rounded-full border border-danger/30 px-2.5 text-xs font-semibold text-danger">
        High priority
      </span>
    );
  }
  return null;
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full bg-sunken px-2.5 text-xs font-semibold text-ink-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}
