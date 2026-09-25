"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { buttonClass, type ButtonStyleProps } from "./Button";

/**
 * A submit button that asks for a second tap before doing something that
 * can't be undone (checking a guest out, disabling a team member).
 */
export function ConfirmSubmit({
  children,
  confirmLabel,
  variant = "secondary",
  size = "sm",
}: ButtonStyleProps & { children: React.ReactNode; confirmLabel: string }) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();

  if (!armed) {
    return (
      <button type="button" className={buttonClass({ variant, size })} onClick={() => setArmed(true)}>
        {children}
      </button>
    );
  }
  return (
    <span className="inline-flex gap-1.5">
      <button type="submit" disabled={pending} className={buttonClass({ variant: "danger", size })} autoFocus>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {confirmLabel}
      </button>
      <button type="button" className={buttonClass({ variant: "ghost", size })} onClick={() => setArmed(false)}>
        Keep
      </button>
    </span>
  );
}
