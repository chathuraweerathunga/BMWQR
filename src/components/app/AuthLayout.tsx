import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { StatusBadge } from "@/components/ui/Status";
import type { RequestStatus } from "@/modules/requests/types";

const SAMPLE: Array<{ title: string; where: string; status: RequestStatus; when: string }> = [
  { title: "Two extra towels, please", where: "Room 208", status: "IN_PROGRESS", when: "4 min ago" },
  { title: "Sun lounger umbrella is broken", where: "Pool, table 4", status: "ACCEPTED", when: "9 min ago" },
  { title: "Late checkout until 1 pm?", where: "Room 311", status: "NEW", when: "just now" },
];

/**
 * Two-column frame for sign-in and sign-up: the form on the left, and on
 * wider screens a quiet picture of what the product does on the right,
 * using the real status components, not a screenshot.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="self-start" aria-label="OneWeb home">
          <Wordmark />
        </Link>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">{children}</div>
      </div>

      <aside className="relative hidden overflow-hidden bg-lagoon-900 lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div
          aria-hidden
          className="absolute -right-32 -top-32 size-[520px] rounded-full border-[56px] border-white/[0.04]"
        />
        <div className="relative max-w-md">
          <p className="font-display text-[34px] leading-[1.15] text-white">
            Every guest request, seen by the right person, the moment it&apos;s made.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">
            Guests ask from their phone. Housekeeping, maintenance and the front desk see it at once.
            Managers see the whole property.
          </p>

          <ul className="mt-10 flex flex-col gap-3" aria-label="Example requests">
            {SAMPLE.map((r, i) => (
              <li
                key={r.title}
                className="animate-ticket-in flex items-center justify-between gap-4 rounded-[var(--radius-panel)] bg-white px-4 py-3.5 shadow-[var(--shadow-lift)]"
                style={{ animationDelay: `${200 + i * 140}ms` }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{r.title}</p>
                  <p className="mt-0.5 text-[13px] text-ink-faint">
                    {r.where}, {r.when}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
