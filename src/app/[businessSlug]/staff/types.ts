/** Shared between the invite server action and the client form. */
export interface InviteRevealState {
  name: string;
  email: string;
  temporaryPassword: string;
  error?: string;
  nonce?: number;
}
