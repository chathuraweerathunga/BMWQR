/** Shared between the check-in server action and the client form that
 * calls it via useActionState. */
export interface CheckInRevealState {
  guestName: string;
  activationUrl: string;
  /** data: URL of a QR code for the same link, for scanning at the desk. */
  activationQr?: string;
  error?: string;
  /** Increments per successful check-in so the form resets. */
  nonce?: number;
}
