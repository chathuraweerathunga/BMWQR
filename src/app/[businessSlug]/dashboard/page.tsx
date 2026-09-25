import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Circle, ClipboardList, Inbox } from "lucide-react";
import { getStaffContext } from "@/lib/staff-context";
import { permissionsForActor } from "@/modules/auth/permissions";
import { listRequestsForBusiness } from "@/modules/requests/repository";
import {
  acceptRequest,
  assignRequest,
  cancelRequest,
  completeRequest,
  rejectRequest,
  startRequest,
} from "@/modules/requests/service";
import { listStaffForBusiness } from "@/modules/staff/repository";
import { getSetupProgress } from "@/modules/business/setup-progress";
import { DEFAULT_OVERDUE_MINUTES } from "@/modules/analytics/metrics";
import { ConcurrentUpdateError, InvalidTransitionError, NotFoundError } from "@/lib/errors";
import { AuthorizationError } from "@/modules/auth/types";
import type { RequestStatus } from "@/modules/requests/types";
import { BoardTabs, RequestCard, type BoardRequest } from "@/components/app/RequestCard";
import { Alert } from "@/components/ui/Alert";
import { EmptyState, PageHeader, Panel } from "@/components/ui/Layout";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Requests" };

const ACTIVE: RequestStatus[] = ["NEW", "ACCEPTED", "IN_PROGRESS"];
const HISTORY: RequestStatus[] = ["COMPLETED", "CLOSED", "REJECTED", "CANCELLED"];
const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

const ERRORS: Record<string, string> = {
  NOT_ALLOWED: "You don't have permission to do that with this request.",
  INVALID_TRANSITION: "That request has already moved on. The board has been refreshed.",
  CONCURRENT_UPDATE: "Someone else updated that request at the same moment. The board has been refreshed.",
  NOT_FOUND: "That request or team member no longer exists.",
};

const COLUMNS: Array<{ status: RequestStatus; title: string; empty: string }> = [
  { status: "NEW", title: "New", empty: "Nothing waiting" },
  { status: "ACCEPTED", title: "Accepted", empty: "Nothing accepted yet" },
  { status: "IN_PROGRESS", title: "In progress", empty: "Nothing under way" },
];

/** Urgent first, then oldest first: the order a shift lead works a queue. */
function byUrgency(a: BoardRequest, b: BoardRequest) {
  const p = (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
  return p !== 0 ? p : a.createdAt.getTime() - b.createdAt.getTime();
}

function SetupChecklist({ slug, progress }: { slug: string; progress: Awaited<ReturnType<typeof getSetupProgress>> }) {
  const steps = [
    { done: progress.locations > 0, label: "Add your rooms and areas", href: `/${slug}/locations` },
    { done: progress.services > 0, label: "List the services guests can ask for", href: `/${slug}/services` },
    { done: progress.qrCodes > 0, label: "Create QR codes for rooms", href: `/${slug}/qr` },
    { done: progress.teamMembers > 1, label: "Add your team", href: `/${slug}/staff` },
    { done: progress.guestsCheckedIn > 0, label: "Check in your first guest", href: `/${slug}/checkin` },
  ];
  const remaining = steps.filter((s) => !s.done).length;
  if (remaining === 0) return null;
  return (
    <Panel className="mb-8 overflow-hidden">
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[1fr_1.3fr] md:items-center">
        <div>
          <h2 className="font-display text-2xl text-lagoon-900">Get ready for your first guest</h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            {remaining} of {steps.length} steps left. Guests can start sending requests once rooms and services exist.
          </p>
        </div>
        <ol className="flex flex-col gap-1">
          {steps.map((step) => (
            <li key={step.label}>
              <Link
                href={step.href}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold hover:bg-sunken",
                  step.done ? "text-ink-faint line-through" : "text-ink",
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="size-5 text-st-done" aria-hidden />
                ) : (
                  <Circle className="size-5 text-line-strong" aria-hidden />
                )}
                {step.label}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}

export default async function RequestsBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ view?: string; error?: string; welcome?: string }>;
}) {
  const { businessSlug } = await params;
  const { view, error } = await searchParams;
  const { business, actor } = await getStaffContext(businessSlug);
  const permissions = permissionsForActor(actor);
  const isStaff = actor.role === "STAFF";
  const canAssign = permissions.has("request:reassign");
  const tab = view === "history" ? "history" : view === "mine" ? "mine" : "open";
  const base = `/${businessSlug}/dashboard`;

  const [openRequests, history, team, progress] = await Promise.all([
    listRequestsForBusiness(business.id, {
      status: ACTIVE,
      // STAFF see what they can act on: their own, plus unassigned requests
      // for their department. A display filter; authorize() is the boundary.
      staffQueue: isStaff ? { membershipId: actor.membershipId, departmentId: actor.departmentId } : undefined,
    }),
    tab === "history"
      ? listRequestsForBusiness(business.id, {
          status: HISTORY,
          staffQueue: isStaff ? { membershipId: actor.membershipId, departmentId: actor.departmentId } : undefined,
          limit: 60,
        })
      : Promise.resolve([]),
    canAssign ? listStaffForBusiness(business.id) : Promise.resolve([]),
    isStaff ? Promise.resolve(null) : getSetupProgress(business.id),
  ]);

  const mineCount = openRequests.filter((r: BoardRequest) => r.assignedMembershipId === actor.membershipId).length;
  const visible = (tab === "mine"
    ? openRequests.filter((r: BoardRequest) => r.assignedMembershipId === actor.membershipId)
    : openRequests) as BoardRequest[];
  const teamOptions = team
    .filter((m: { status: string }) => m.status === "ACTIVE")
    .map((m: { id: string; user: { name: string } }) => ({ id: m.id, name: m.user.name }));

  async function transitionAction(formData: FormData) {
    "use server";
    const action = formData.get("action");
    const requestId = formData.get("requestId");
    if (typeof action !== "string" || typeof requestId !== "string") return;
    try {
      if (action === "accept") await acceptRequest(actor, business.id, requestId);
      else if (action === "start") await startRequest(actor, business.id, requestId);
      else if (action === "complete") await completeRequest(actor, business.id, requestId);
      else if (action === "reject") await rejectRequest(actor, business.id, requestId);
      else if (action === "cancel") await cancelRequest(actor, business.id, requestId);
    } catch (err) {
      const code =
        err instanceof AuthorizationError
          ? "NOT_ALLOWED"
          : err instanceof InvalidTransitionError
            ? "INVALID_TRANSITION"
            : err instanceof ConcurrentUpdateError
              ? "CONCURRENT_UPDATE"
              : err instanceof NotFoundError
                ? "NOT_FOUND"
                : null;
      if (!code) throw err;
      redirect(`${base}?error=${code}${tab !== "open" ? `&view=${tab}` : ""}`);
    }
    redirect(`${base}${tab !== "open" ? `?view=${tab}` : ""}`);
  }

  async function assignAction(formData: FormData) {
    "use server";
    const requestId = formData.get("requestId");
    const membershipId = formData.get("membershipId");
    if (typeof requestId !== "string") return;
    try {
      await assignRequest(actor, business.id, requestId, typeof membershipId === "string" && membershipId ? membershipId : null);
    } catch (err) {
      const code =
        err instanceof AuthorizationError
          ? "NOT_ALLOWED"
          : err instanceof NotFoundError
            ? "NOT_FOUND"
            : err instanceof InvalidTransitionError
              ? "INVALID_TRANSITION"
              : null;
      if (!code) throw err;
      redirect(`${base}?error=${code}`);
    }
    redirect(base);
  }

  const now = new Date();
  const cardProps = {
    now,
    timeZone: business.timezone,
    overdueMinutes: DEFAULT_OVERDUE_MINUTES,
    actorMembershipId: actor.membershipId,
    permissions: {
      canReject: permissions.has("request:reject"),
      canCancel: permissions.has("request:cancel_any"),
      canAssign,
    },
    team: teamOptions,
    transitionAction,
    assignAction,
  };

  return (
    <>
      <PageHeader
        title="Requests"
        description={
          isStaff
            ? "Requests you can take, and the ones assigned to you. New ones appear here by themselves."
            : "Everything guests have asked for. New requests appear here by themselves."
        }
        actions={
          <BoardTabs
            tabs={[
              { href: base, label: "Open", active: tab === "open", count: openRequests.length },
              { href: `${base}?view=mine`, label: "Mine", active: tab === "mine", count: mineCount },
              { href: `${base}?view=history`, label: "History", active: tab === "history" },
            ]}
          />
        }
      />

      {progress && <SetupChecklist slug={businessSlug} progress={progress} />}

      {error && ERRORS[error] && (
        <Alert tone="error" className="mb-6">
          {ERRORS[error]}
        </Alert>
      )}

      {tab === "history" ? (
        history.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-6" />} title="No finished requests yet">
            Completed, declined and cancelled requests are kept here.
          </EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(history as BoardRequest[]).map((r) => (
              <RequestCard key={r.id} request={r} {...cardProps} />
            ))}
          </div>
        )
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-6" />}
          title={tab === "mine" ? "Nothing assigned to you" : "All caught up"}
          action={
            !isStaff && progress && progress.services === 0 ? (
              <ButtonLink href={`/${businessSlug}/services`}>Add services</ButtonLink>
            ) : undefined
          }
        >
          {tab === "mine"
            ? "Accept a request from the Open view and it will show here."
            : "No open requests right now. This page updates by itself when a guest asks for something."}
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = visible.filter((r) => r.status === col.status).sort(byUrgency);
            return (
              <section key={col.status} aria-labelledby={`col-${col.status}`} className="flex flex-col gap-3">
                <h2 id={`col-${col.status}`} className="flex items-center gap-2 text-sm font-bold text-ink-soft">
                  {col.title}
                  <span className="rounded-full bg-sunken px-2 py-0.5 text-xs text-ink-faint tabular">{items.length}</span>
                </h2>
                {items.length === 0 ? (
                  <p className="rounded-[var(--radius-panel)] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-faint">
                    {col.empty}
                  </p>
                ) : (
                  items.map((r) => <RequestCard key={r.id} request={r} {...cardProps} />)
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
