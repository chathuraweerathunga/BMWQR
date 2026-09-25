import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "brand";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap rounded-[var(--radius-control)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 select-none";

const variants: Record<Variant, string> = {
  primary: "bg-lagoon-700 text-white hover:bg-lagoon-800 active:bg-lagoon-900",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-sunken hover:border-ink-faint active:bg-line",
  ghost: "text-ink-soft hover:bg-sunken hover:text-ink",
  danger: "bg-surface text-danger border border-line-strong hover:bg-danger-bg hover:border-danger",
  // Tenant-branded: guest pages set --brand / --brand-ink.
  brand: "bg-[var(--brand)] text-[var(--brand-ink)] hover:brightness-110 active:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-13 px-6 text-base",
};

export interface ButtonStyleProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  block?: boolean;
}

export function buttonClass({ variant = "primary", size = "md", className, block }: ButtonStyleProps = {}) {
  return cn(base, variants[variant], sizes[size], block && "w-full", className);
}

export function Button({
  variant,
  size,
  block,
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps) {
  return <button type={type} className={buttonClass({ variant, size, block, className })} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  block,
  className,
  ...props
}: React.ComponentProps<typeof Link> & ButtonStyleProps) {
  return <Link className={buttonClass({ variant, size, block, className })} {...props} />;
}
