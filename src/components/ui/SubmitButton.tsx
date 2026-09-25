"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { buttonClass, type ButtonStyleProps } from "./Button";

/**
 * A form's submit button that disables itself and shows progress while
 * the server action runs. Prevents double submissions (a guest tapping
 * "Send request" twice, staff double-accepting) on slow hotel Wi-Fi.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant,
  size,
  block,
  className,
  name,
  value,
  disabled,
}: ButtonStyleProps & {
  children: React.ReactNode;
  pendingLabel?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-busy={pending}
      className={buttonClass({ variant, size, block, className })}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
