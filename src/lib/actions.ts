import { NotFoundError, ValidationError } from "@/lib/errors";
import { AuthorizationError } from "@/modules/auth/types";
import type { ActionResult } from "@/components/ui/ActionForm";

/**
 * Runs a management action and turns the expected failures into a message
 * for the person using the form. Anything unexpected is logged server-side
 * and shown as a plain retry message, never as an internal error (section 46).
 */
export async function runAction(
  label: string,
  work: () => Promise<string | void>,
): Promise<ActionResult> {
  try {
    const success = await work();
    return { success: success ?? "Saved." };
  } catch (err) {
    if (err instanceof ValidationError) return { error: err.message };
    if (err instanceof AuthorizationError) return { error: "You don't have permission to do that." };
    if (err instanceof NotFoundError) return { error: "That item no longer exists. Refresh the page." };
    console.error(`[${label}] unexpected failure`, err);
    return { error: "That didn't save. Try again." };
  }
}

/** Reads a trimmed string field; empty becomes null. */
export function textField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
