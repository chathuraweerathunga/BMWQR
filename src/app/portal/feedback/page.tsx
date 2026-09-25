import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Star } from "lucide-react";
import { loadGuestPortal } from "@/lib/guest-portal";
import { GUEST_ERROR_MESSAGES } from "@/lib/guest-context";
import { submitGuestFeedback } from "@/modules/feedback/service";
import { listRequestsForGuestStayDetailed } from "@/modules/requests/repository";
import { AuthorizationError } from "@/modules/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { GuestNotice, GuestShell } from "@/components/guest/GuestShell";
import { Alert } from "@/components/ui/Alert";
import { Field, Select, Textarea } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Feedback", robots: { index: false } };

const FEEDBACK_SUBMIT_LIMIT = 5;
const FEEDBACK_SUBMIT_WINDOW_MS = 60 * 60_000;
const CATEGORIES = ["Cleanliness", "Staff", "Speed", "Comfort", "Food & drink", "Facilities"];
const ALLOWED_CATEGORIES = new Set(CATEGORIES);
const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

const ERRORS: Record<string, string> = {
  MISSING_RATING: "Choose a star rating to send your feedback.",
  INVALID: "That feedback couldn't be saved. Check your rating and try again.",
  RATE_LIMITED: "You've sent feedback several times recently. Try again later.",
};

export default async function GuestFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string; request?: string }>;
}) {
  const { error, submitted, request: preselect } = await searchParams;
  const result = await loadGuestPortal();
  if (!result.ok) {
    return (
      <GuestNotice
        title="Feedback"
        message={GUEST_ERROR_MESSAGES[result.errorCode] ?? GUEST_ERROR_MESSAGES.NO_GUEST_SESSION}
      />
    );
  }
  const { portal } = result;
  const done = (await listRequestsForGuestStayDetailed(portal.actor.businessId, portal.actor.guestStayId)).filter(
    (r: { status: string }) => r.status === "COMPLETED" || r.status === "CLOSED",
  );

  async function submitFeedback(formData: FormData) {
    "use server";
    const fresh = await loadGuestPortal();
    if (!fresh.ok) redirect(`/portal?error=${fresh.errorCode}`);
    const { actor } = fresh.portal;

    const limit = await rateLimit(`feedback-create:${actor.guestSessionId}`, FEEDBACK_SUBMIT_LIMIT, FEEDBACK_SUBMIT_WINDOW_MS);
    if (!limit.allowed) redirect("/portal/feedback?error=RATE_LIMITED");

    const ratingRaw = formData.get("rating");
    if (typeof ratingRaw !== "string" || !ratingRaw) redirect("/portal/feedback?error=MISSING_RATING");
    const comment = formData.get("comment");
    const requestId = formData.get("requestId");
    const categories = formData
      .getAll("categories")
      .filter((c): c is string => typeof c === "string" && ALLOWED_CATEGORIES.has(c));

    try {
      await submitGuestFeedback(actor, {
        rating: Number(ratingRaw),
        comment: typeof comment === "string" && comment.trim() ? comment : null,
        categories,
        requestId: typeof requestId === "string" && requestId ? requestId : null,
      });
    } catch (err) {
      if (err instanceof ValidationError || err instanceof AuthorizationError || err instanceof NotFoundError) {
        redirect("/portal/feedback?error=INVALID");
      }
      throw err;
    }
    redirect("/portal/feedback?submitted=1");
  }

  if (submitted) {
    return (
      <GuestShell branding={portal.branding}>
        <div className="flex flex-col items-center pt-16 text-center">
          <div className="flex gap-1 text-brass-500" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className="size-7 fill-current" />
            ))}
          </div>
          <h1 className="mt-6 font-display text-[32px] text-ink">Thank you</h1>
          <p className="mt-2 max-w-xs text-[15px] text-ink-soft">
            Your feedback goes straight to the team at {portal.branding.name}.
          </p>
          <ButtonLink href="/portal" variant="secondary" className="mt-8">
            Back to services
          </ButtonLink>
        </div>
      </GuestShell>
    );
  }

  return (
    <GuestShell branding={portal.branding}>
      <h1 className="pt-7 font-display text-[32px] leading-tight text-ink">How are we doing?</h1>
      <p className="mt-2 text-[15px] text-ink-soft">A few seconds of your time helps the team get it right.</p>

      {error && ERRORS[error] && (
        <Alert tone="error" className="mt-5">
          {ERRORS[error]}
        </Alert>
      )}

      <form action={submitFeedback} className="mt-7 flex flex-col gap-7">
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Your rating</legend>
          {/* Row-reversed so that checking star N also lights stars 1..N-1 via the sibling selector. */}
          <div className="mt-3 flex flex-row-reverse justify-end gap-1.5">
            {[5, 4, 3, 2, 1].map((value) => (
              <span key={value} className="contents">
                <input
                  type="radio"
                  id={`rating-${value}`}
                  name="rating"
                  value={value}
                  required
                  className="peer sr-only"
                />
                <label
                  htmlFor={`rating-${value}`}
                  title={RATING_WORDS[value]}
                  className="grid size-13 cursor-pointer place-items-center rounded-[var(--radius-control)] text-line-strong transition-colors hover:text-brass-300 peer-checked:text-brass-500 peer-focus-visible:outline-2 peer-focus-visible:outline-brass-500"
                >
                  <Star className="size-9 fill-current" aria-hidden />
                  <span className="sr-only">
                    {value} star{value > 1 ? "s" : ""}, {RATING_WORDS[value]}
                  </span>
                </label>
              </span>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-ink">
            What stood out? <span className="font-normal text-ink-faint">optional</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <label
                key={c}
                className="cursor-pointer rounded-full border border-line-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink-soft has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand-soft)] has-[:checked]:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brass-500"
              >
                <input type="checkbox" name="categories" value={c} className="sr-only" />
                {c}
              </label>
            ))}
          </div>
        </fieldset>

        {done.length > 0 && (
          <Field label="About a specific request" htmlFor="requestId" optional>
            <Select id="requestId" name="requestId" defaultValue={preselect ?? ""}>
              <option value="">My stay in general</option>
              {done.map((r: (typeof done)[number]) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Anything to add?" htmlFor="comment" optional>
          <Textarea id="comment" name="comment" rows={4} maxLength={2000} placeholder="What went well, or what we could do better" />
        </Field>

        <SubmitButton variant="brand" size="lg" block pendingLabel="Sending">
          Send feedback
        </SubmitButton>
      </form>
    </GuestShell>
  );
}
