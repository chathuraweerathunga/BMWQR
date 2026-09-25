import { cn } from "@/lib/cn";

/** OneWeb's mark: a front-desk service bell reduced to three strokes. */
export function BellMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path d="M8 22.5h16" stroke="#e2c07a" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M9.5 20.5a6.5 6.5 0 0 1 13 0"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M16 11.2v2.8" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="9.6" r="1.6" fill="#e2c07a" />
    </svg>
  );
}

export function Wordmark({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BellMark className={tone === "dark" ? "text-lagoon-800" : "text-white/15"} />
      <span
        className={cn(
          "text-[17px] font-extrabold tracking-tight",
          tone === "dark" ? "text-ink" : "text-white",
        )}
      >
        OneWeb
      </span>
    </span>
  );
}
