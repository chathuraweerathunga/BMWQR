/** Shared between the check-in server action and the client component that
 * calls it via useActionState. */
export interface CheckInRevealState {
  guestName: string;
  activationUrl: string;
  error?: string;
}
