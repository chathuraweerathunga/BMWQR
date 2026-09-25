import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "info";

const tones: Record<Tone, { box: string; Icon: typeof Info }> = {
  success: { box: "bg-st-done-bg text-st-done border-st-done/20", Icon: CheckCircle2 },
  error: { box: "bg-danger-bg text-danger border-danger/20", Icon: AlertCircle },
  info: { box: "bg-lagoon-50 text-lagoon-800 border-lagoon-200", Icon: Info },
};

/** An inline message. `role` makes screen readers announce it. */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { box, Icon } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-[var(--radius-control)] border px-4 py-3 text-sm", box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
