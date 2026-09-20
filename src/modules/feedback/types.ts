export interface SubmitFeedbackInput {
  rating: number;
  comment?: string | null;
  categories?: string[];
  /** Optional: ties feedback to the specific request it's about. When
   * given, must belong to the same guest that's submitting it. */
  requestId?: string | null;
}
