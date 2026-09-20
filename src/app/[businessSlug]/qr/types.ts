/** Shared between the server actions in page.tsx and the client
 * components that call them via useActionState. */
export interface QrRevealState {
  url: string;
  imageDataUrl: string;
}
