import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff-context";
import { listRequestsForBusiness } from "@/modules/requests/repository";
import {
  acceptRequest,
  startRequest,
  completeRequest,
  rejectRequest,
  cancelRequest,
} from "@/modules/requests/service";
import { InvalidTransitionError, ConcurrentUpdateError } from "@/lib/errors";
import { AuthorizationError } from "@/modules/auth/types";
import type { RequestStatus } from "@/modules/requests/types";

const ACTIVE_STATUSES: RequestStatus[] = ["NEW", "ACCEPTED", "IN_PROGRESS"];

const ACTION_LABELS: Record<string, string> = {
  accept: "Accept",
  start: "Start",
  complete: "Complete",
  reject: "Reject",
  cancel: "Cancel",
};

export default async function StaffDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { businessSlug } = await params;
  const { status, error } = await searchParams;
  const { business, actor } = await getStaffContext(businessSlug);

  const showAll = status === "all";
  const requests = await listRequestsForBusiness(business.id, {
    status: showAll ? undefined : ACTIVE_STATUSES,
    // STAFF see their own queue: requests unassigned (available to claim)
    // or already assigned to them. Department-scoping the *unassigned*
    // half of this further is a UX refinement for later — authorize()
    // still blocks accepting a request outside their department either
    // way, so this is a display convenience, not a security boundary.
    unassignedOrOwnedBy: actor.role === "STAFF" ? actor.membershipId : undefined,
  });

  async function performTransition(formData: FormData) {
    "use server";
    const action = formData.get("action");
    const requestId = formData.get("requestId");
    if (typeof action !== "string" || typeof requestId !== "string") return;

    try {
      switch (action) {
        case "accept":
          await acceptRequest(actor, business.id, requestId);
          break;
        case "start":
          await startRequest(actor, business.id, requestId);
          break;
        case "complete":
          await completeRequest(actor, business.id, requestId);
          break;
        case "reject":
          await rejectRequest(actor, business.id, requestId);
          break;
        case "cancel":
          await cancelRequest(actor, business.id, requestId);
          break;
      }
    } catch (err) {
      const message =
        err instanceof AuthorizationError
          ? "NOT_ALLOWED"
          : err instanceof InvalidTransitionError
            ? "INVALID_TRANSITION"
            : err instanceof ConcurrentUpdateError
              ? "CONCURRENT_UPDATE"
              : "UNKNOWN";
      redirect(`/${businessSlug}/dashboard?error=${message}`);
    }
    redirect(`/${businessSlug}/dashboard${showAll ? "?status=all" : ""}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Requests</h1>
        <a
          href={`/${businessSlug}/dashboard${showAll ? "" : "?status=all"}`}
          className="text-sm text-gray-600 underline"
        >
          {showAll ? "Show active only" : "Show all"}
        </a>
      </div>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          That action couldn&apos;t be completed ({error}). The request may have been
          updated by someone else — reload and try again.
        </p>
      )}

      {requests.length === 0 && (
        <p className="text-sm text-gray-500">No requests to show.</p>
      )}

      <ul className="flex flex-col gap-3">
        {requests.map((request: (typeof requests)[number]) => {
          const availableActions: Array<{ action: string; label: string }> = [];
          if (request.status === "NEW") {
            availableActions.push({ action: "accept", label: ACTION_LABELS.accept });
            availableActions.push({ action: "reject", label: ACTION_LABELS.reject });
            availableActions.push({ action: "cancel", label: ACTION_LABELS.cancel });
          } else if (request.status === "ACCEPTED") {
            availableActions.push({ action: "start", label: ACTION_LABELS.start });
            availableActions.push({ action: "cancel", label: ACTION_LABELS.cancel });
          } else if (request.status === "IN_PROGRESS") {
            availableActions.push({ action: "complete", label: ACTION_LABELS.complete });
          }

          return (
            <li
              key={request.id}
              className="flex items-center justify-between rounded border border-gray-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {request.title}
                  <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {request.status}
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  {request.location?.name ?? "Unknown location"}
                  {request.service ? ` · ${request.service.name}` : ""}
                  {request.department ? ` · ${request.department.name}` : ""}
                  {request.assignedMembership?.user?.name
                    ? ` · assigned to ${request.assignedMembership.user.name}`
                    : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {availableActions.map(({ action, label }) => (
                  <form action={performTransition} key={action}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="action" value={action} />
                    <button
                      type="submit"
                      className="rounded border border-gray-300 px-3 py-1 text-xs font-medium"
                    >
                      {label}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
