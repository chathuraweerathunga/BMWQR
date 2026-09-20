import { redirect } from "next/navigation";
import Link from "next/link";
import { getGuestPortalContext, GUEST_ERROR_MESSAGES } from "@/lib/guest-context";
import { submitGuestFeedback } from "@/modules/feedback/service";
import { ValidationError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";

const RATING_OPTIONS = [5, 4, 3, 2, 1];
const FEEDBACK_SUBMIT_LIMIT = 5;
const FEEDBACK_SUBMIT_WINDOW_MS = 60 * 60_000;

const FEEDBACK_ERROR_MESSAGES: Record<string, string> = {
  MISSING_RATING: "Please choose a rating.",
  INVALID_RATING: "Please choose a rating from 1 to 5.",
  RATE_LIMITED: "Too many attempts — please wait a moment and try again.",
};

export default async function GuestFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const { error, submitted } = await searchParams;
  const context = await getGuestPortalContext();

  if (!context.ok) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Feedback</h1>
        <p className="text-sm text-gray-600">
          {GUEST_ERROR_MESSAGES[context.errorCode] ?? GUEST_ERROR_MESSAGES.NO_GUEST_SESSION}
        </p>
      </main>
    );
  }

  const { actor } = context;

  async function submitFeedback(formData: FormData) {
    "use server";

    const limitResult = rateLimit(
      `feedback-create:${actor.guestSessionId}`,
      FEEDBACK_SUBMIT_LIMIT,
      FEEDBACK_SUBMIT_WINDOW_MS,
    );
    if (!limitResult.allowed) {
      redirect("/portal/feedback?error=RATE_LIMITED");
    }

    const ratingRaw = formData.get("rating");
    const comment = formData.get("comment");

    if (typeof ratingRaw !== "string" || ratingRaw.length === 0) {
      redirect("/portal/feedback?error=MISSING_RATING");
    }
    const rating = Number(ratingRaw);

    try {
      await submitGuestFeedback(actor, {
        rating,
        comment: typeof comment === "string" && comment.trim().length > 0 ? comment : null,
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        redirect("/portal/feedback?error=INVALID_RATING");
      }
      throw err;
    }

    redirect("/portal/feedback?submitted=1");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold">How was your stay?</h1>
        <p className="text-sm text-gray-500">Your feedback helps us do better.</p>
      </header>

      {submitted && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          Thank you for your feedback!
        </p>
      )}

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {FEEDBACK_ERROR_MESSAGES[error] ?? "Something went wrong — please try again."}
        </p>
      )}

      <form action={submitFeedback} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Rating</legend>
          <div className="flex gap-3">
            {RATING_OPTIONS.map((value) => (
              <label
                key={value}
                className="flex flex-1 cursor-pointer flex-col items-center gap-1 rounded border border-gray-300 py-2 text-sm has-[:checked]:border-black has-[:checked]:bg-gray-50"
              >
                <input type="radio" name="rating" value={value} required className="sr-only" />
                {value} {"★".repeat(value)}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          Comments (optional)
          <textarea
            name="comment"
            rows={4}
            placeholder="Tell us more…"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
        >
          Submit feedback
        </button>
      </form>

      <Link href="/portal" className="text-center text-sm text-gray-500 underline">
        Back to guest services
      </Link>
    </main>
  );
}
