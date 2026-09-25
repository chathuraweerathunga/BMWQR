import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { Check, ClipboardList, LogOut } from "lucide-react";
import { loadGuestPortal } from "@/lib/guest-portal";
import { GUEST_ERROR_MESSAGES } from "@/lib/guest-context";
import { clearGuestSessionCookie } from "@/lib/guest-cookie";
import { listRequestsForGuestStayDetailed } from "@/modules/requests/repository";
import { cancelRequest } from "@/modules/requests/service";
import { revokeSession } from "@/modules/guest-sessions/repository";
import { AuthorizationError } from "@/modules/auth/types";
import { ConcurrentUpdateError, InvalidTransitionError, NotFoundError } from "@/lib/errors";
import { GuestNotice, GuestShell } from "@/components/guest/GuestShell";
import { ServiceIcon } from "@/components/guest/ServiceIcon";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/Status";
import { EmptyState } from "@/components/ui/Layout";
import { ButtonLink } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { LiveRefresh } from "@/components/ui/LiveRefresh";
import { formatTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { RequestStatus } from "@/modules/requests/types";

export const metadata: Metadata = { title: "My requests", robots: { index: false } };

const ACTIVE: RequestStatus[] = ["NEW", "ACCEPTED", "IN_PROGRESS"];
const GUEST_CANCELLABLE: RequestStatus[] = ["NEW", "ACCEPTED"];

interface Step {
  label: string;
  at: Date | null;
  reached: boolean;
}

function stepsFor(r: {
  status: string;
  createdAt: Date;
  acceptedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}): Step[] {
  const s = r.status as RequestStatus;
  const rank = { NEW: 0, ACCEPTED: 1, IN_PROGRESS: 2, COMPLETED: 3, CLOSED: 3, REJECTED: -1, CANCELLED: -1 }[s];
  return [
    { label: "Received", at: r.createdAt, reached: true },
    { label: "Accepted", at: r.acceptedAt, reached: rank >= 1 },
    { label: "On the way", at: r.startedAt, reached: rank >= 2 },
    { label: "Done", at: r.completedAt, reached: rank >= 3 },
  ];
}

export default async function GuestRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;
  const result = await loadGuestPortal();
  if (!result.ok) {
    return (
      <GuestNotice
        title="My requests"
        message={GUEST_ERROR_MESSAGES[result.errorCode] ?? GUEST_ERROR_MESSAGES.NO_GUEST_SESSION}
      />
    );
  }
  const { portal } = result;
  const tz = portal.branding.timezone;
  const requests = await listRequestsForGuestStayDetailed(portal.actor.businessId, portal.actor.guestStayId);
  const anyActive = requests.some((r: { status: string }) => ACTIVE.includes(r.status as RequestStatus));

  async function cancel(formData: FormData) {
    "use server";
    const fresh = await loadGuestPortal();
    if (!fresh.ok) redirect(`/portal?error=${fresh.errorCode}`);
    const requestId = formData.get("requestId");
    if (typeof requestId !== "string") return;
    try {
      // Ownership is enforced inside: a guest can only cancel a request
      // their own stay created (authorize() row-level rule).
      await cancelRequest(fresh.portal.actor, fresh.portal.actor.businessId, requestId);
    } catch (err) {
      if (
        err instanceof AuthorizationError ||
        err instanceof InvalidTransitionError ||
        err instanceof ConcurrentUpdateError ||
        err instanceof NotFoundError
      ) {
        redirect("/portal/requests?error=CANCEL_FAILED");
      }
      throw err;
    }
    redirect("/portal/requests");
  }

  async function signOutDevice() {
    "use server";
    const fresh = await loadGuestPortal();
    if (fresh.ok) await revokeSession(fresh.portal.actor.businessId, fresh.portal.actor.guestSessionId);
    clearGuestSessionCookie(await cookies());
    redirect("/portal?error=SIGNED_OUT");
  }

  return (
    <GuestShell branding={portal.branding}>
      <LiveRefresh active={anyActive} />
      <h1 className="pt-7 font-display text-[32px] leading-tight text-ink">My requests</h1>

      {sent && (
        <Alert tone="success" className="mt-5" title="Request sent">
          The team has it now. This page updates by itself as they work on it.
        </Alert>
      )}
      {error === "CANCEL_FAILED" && (
        <Alert tone="error" className="mt-5">
          That request is already being handled, so it can&apos;t be cancelled here. Call reception if you need to change it.
        </Alert>
      )}

      {requests.length === 0 ? (
        <EmptyState
          className="mt-6 bg-surface"
          icon={<ClipboardList className="size-6" />}
          title="No requests yet"
          action={
            <ButtonLink href="/portal" variant="brand">
              Browse services
            </ButtonLink>
          }
        >
          Anything you ask for during your stay shows up here, with live progress.
        </EmptyState>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {requests.map((r: (typeof requests)[number]) => {
            const status = r.status as RequestStatus;
            const steps = stepsFor(r);
            const stopped = status === "CANCELLED" || status === "REJECTED";
            return (
              <li
                key={r.id}
                className={cn(
                  "rounded-[var(--radius-panel)] border bg-surface p-4",
                  r.id === sent ? "animate-ticket-in border-[var(--brand)]" : "border-line",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                    <ServiceIcon icon={r.service?.icon} name={r.service?.name ?? r.title} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-snug text-ink">{r.title}</p>
                    <p className="mt-0.5 text-[13px] text-ink-faint">
                      {r.location.name}, {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={status} audience="guest" />
                </div>

                {r.description && <p className="mt-3 text-sm text-ink-soft">{r.description}</p>}

                {!stopped && (
                  <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Progress">
                    {steps.map((step, i) => (
                      <li key={step.label} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1">
                          <span
                            className={cn(
                              "grid size-4 shrink-0 place-items-center rounded-full",
                              step.reached ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "border-2 border-line-strong",
                            )}
                          >
                            {step.reached && <Check className="size-2.5" strokeWidth={4} aria-hidden />}
                          </span>
                          {i < steps.length - 1 && (
                            <span className={cn("h-0.5 flex-1 rounded", steps[i + 1].reached ? "bg-[var(--brand)]" : "bg-line")} />
                          )}
                        </div>
                        <span className={cn("text-xs leading-tight", step.reached ? "font-bold text-ink" : "text-ink-faint")}>
                          {step.label}
                        </span>
                        {step.reached && step.at && (
                          <span className="text-[11px] text-ink-faint tabular">{formatTime(step.at, tz)}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {GUEST_CANCELLABLE.includes(status) && (
                  <form action={cancel} className="mt-4 border-t border-line pt-3">
                    <input type="hidden" name="requestId" value={r.id} />
                    <SubmitButton variant="ghost" size="sm" pendingLabel="Cancelling" className="-ml-2">
                      Cancel request
                    </SubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form action={signOutDevice} className="mt-10 flex justify-center">
        <SubmitButton variant="ghost" size="sm" pendingLabel="Signing out">
          <LogOut className="size-4" aria-hidden />
          Sign out on this device
        </SubmitButton>
      </form>
      <p className="mt-1 text-center text-xs text-ink-faint">
        <Link href="/portal/feedback" className="underline-offset-4 hover:underline">
          Tell us how we did
        </Link>
      </p>
    </GuestShell>
  );
}
