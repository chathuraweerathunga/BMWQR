import { assertAuthorized } from "@/modules/auth/authorize";
import type { GuestActor } from "@/modules/auth/types";
import { AuthorizationError } from "@/modules/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getRequestById } from "@/modules/requests/repository";
import * as repo from "./repository";
import type { SubmitFeedbackInput } from "./types";

const MAX_COMMENT_LENGTH = 2000;

/**
 * Guest-facing feedback submission (project instructions section 23).
 * `actor` must be derived server-side from a validated guest session, same
 * as request creation — feedback is always attributed to the session's own
 * guest/stay, never a client-supplied id.
 */
export async function submitGuestFeedback(actor: GuestActor, input: SubmitFeedbackInput) {
  assertAuthorized({
    actor,
    action: "feedback:create",
    resource: { businessId: actor.businessId },
  });

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new ValidationError("Rating must be a whole number from 1 to 5.");
  }
  if (input.comment && input.comment.length > MAX_COMMENT_LENGTH) {
    throw new ValidationError("Comment is too long.");
  }

  if (input.requestId) {
    const request = await getRequestById(actor.businessId, input.requestId);
    if (!request) throw new NotFoundError("Request");
    // A guest can only leave feedback tied to their OWN request — never
    // trust the client's claim that a requestId belongs to them.
    if (request.createdByGuestId !== actor.guestId) {
      throw new AuthorizationError("NOT_OWNER");
    }
  }

  return repo.createFeedback({
    businessId: actor.businessId,
    guestId: actor.guestId,
    guestStayId: actor.guestStayId,
    requestId: input.requestId ?? null,
    rating: input.rating,
    comment: input.comment?.trim() || null,
    categories: input.categories ?? [],
  });
}
