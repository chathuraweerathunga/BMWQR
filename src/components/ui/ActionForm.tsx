"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert } from "./Alert";

export interface ActionResult {
  error?: string;
  success?: string;
}

/**
 * A form wired to a server action through useActionState. The action
 * returns `{ error }` or `{ success }` and the message renders above the
 * fields, so feedback never travels through the URL (a crafted link can't
 * put text on the page). On success the fields reset for the next entry.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = true,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {children}
    </form>
  );
}
