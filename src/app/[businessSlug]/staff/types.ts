/** Shared between the invite server action and the client component that
 * calls it via useActionState. */
export interface InviteRevealState {
  name: string;
  email: string;
  temporaryPassword: string;
  error?: string;
}
