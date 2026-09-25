import Link from "next/link";
import { BedDouble, ClipboardCheck, LineChart, QrCode, ShieldCheck, Smartphone, Timer, Users } from "lucide-react";
import { getCurrentUserId } from "@/lib/session";
import { listActiveMembershipsForUser } from "@/modules/staff/repository";
import { Wordmark } from "@/components/brand/Wordmark";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Status";
import { Avatar, EmptyState } from "@/components/ui/Layout";
import { cn } from "@/lib/cn";

const ROLE_LABEL: Record<string, string> = { BUSINESS_OWNER: "Owner", MANAGER: "Manager", STAFF: "Staff" };

/** The request journey, drawn as a track: the product in one picture. */
const JOURNEY = [
  { label: "Guest asks", detail: "Room 208: two extra towels", at: "14:02" },
  { label: "Routed", detail: "Housekeeping", at: "14:02" },
  { label: "Accepted", detail: "Nimali P.", at: "14:04" },
  { label: "Delivered", detail: "Guest notified", at: "14:11" },
];

function JourneyTicket() {
  return (
    <div className="relative rounded-[var(--radius-sheet)] bg-white p-6 shadow-[var(--shadow-lift)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-ink-faint">Ocean Pearl Resort, Room 208</p>
          <p className="mt-1 text-lg font-extrabold text-ink">&ldquo;Please bring two extra towels.&rdquo;</p>
        </div>
        <StatusBadge status="COMPLETED" />
      </div>
      <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Request timeline">
        {JOURNEY.map((step, i) => (
          <li key={step.label} className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "size-3 shrink-0 rounded-full",
                  i === JOURNEY.length - 1 ? "bg-st-done ring-4 ring-st-done-bg" : "bg-lagoon-600",
                )}
              />
              {i < JOURNEY.length - 1 && <span className="h-0.5 flex-1 rounded bg-lagoon-200" />}
            </div>
            <div>
              <p className="text-[13px] font-bold text-ink">{step.label}</p>
              <p className="text-xs leading-snug text-ink-faint">{step.detail}</p>
              <p className="mt-0.5 text-xs font-semibold text-lagoon-700 tabular">{step.at}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex items-center justify-between rounded-[var(--radius-control)] bg-paper px-4 py-3">
        <p className="text-sm text-ink-soft">Done in</p>
        <p className="text-sm font-extrabold text-ink tabular">9 minutes</p>
      </div>
    </div>
  );
}

const ROLES = [
  {
    icon: Smartphone,
    title: "Guests ask from their phone",
    body: "A link from reception or a QR code in the room opens your branded guest services. No app, no account, no typing a room number.",
  },
  {
    icon: ClipboardCheck,
    title: "Your team sees it instantly",
    body: "Requests land with the right department, with the room, the service and the priority. Accept, start, complete: one tap each.",
  },
  {
    icon: LineChart,
    title: "Managers see the whole property",
    body: "What's waiting, what's late, who's overloaded, how fast each department responds, and what guests are saying.",
  },
];

const STEPS = [
  { icon: BedDouble, title: "Check the guest in", body: "Reception creates the stay and hands over a private link." },
  { icon: QrCode, title: "Guest scans or taps", body: "Room and area QR codes tell you where help is needed." },
  { icon: Users, title: "Staff handle it", body: "The request moves from new to done, and the guest watches it happen." },
  { icon: Timer, title: "Checkout ends access", body: "The guest's access stops at checkout. The history stays." },
];

async function SignedInHome({ userId }: { userId: string }) {
  const memberships = await listActiveMembershipsForUser(userId);
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-[28px] font-extrabold tracking-tight">Choose a workspace</h1>
      <p className="mt-1 text-[15px] text-ink-soft">You have access to these properties.</p>
      {memberships.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No workspace yet"
          action={<ButtonLink href="/signup">Create a workspace</ButtonLink>}
        >
          Your account isn&apos;t part of any property. Create one, or ask your manager to add you.
        </EmptyState>
      ) : (
        <ul className="mt-8 flex flex-col gap-2">
          {memberships.map((m: (typeof memberships)[number]) => (
            <li key={m.id}>
              <Link
                href={`/${m.business.slug}/dashboard`}
                className="flex items-center gap-4 rounded-[var(--radius-panel)] border border-line bg-surface px-5 py-4 transition-colors hover:border-lagoon-500"
              >
                <Avatar name={m.business.name} className="size-10 bg-lagoon-100 text-lagoon-800" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{m.business.name}</span>
                  <span className="text-sm text-ink-faint">{ROLE_LABEL[m.role] ?? m.role}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default async function HomePage() {
  const userId = await getCurrentUserId();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="OneWeb home">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-2">
          {userId ? null : (
            <>
              <ButtonLink href="/login" variant="ghost">
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup">Create workspace</ButtonLink>
            </>
          )}
        </nav>
      </header>

      {userId ? (
        <SignedInHome userId={userId} />
      ) : (
        <main className="flex-1">
          <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
            <div>
              <h1 className="font-display text-[44px] leading-[1.04] tracking-[-0.015em] text-lagoon-900 sm:text-[58px]">
                The front desk bell, for the whole property.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
                OneWeb turns guest requests into organised, trackable work for your team, and shows you
                what&apos;s happening across your hotel right now.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/signup" size="lg">
                  Create your workspace
                </ButtonLink>
                <ButtonLink href="/login" size="lg" variant="secondary">
                  Staff sign in
                </ButtonLink>
              </div>
            </div>
            <JourneyTicket />
          </section>

          <section className="border-y border-line bg-surface">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-3">
              {ROLES.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <Icon className="size-6 text-brass-500" aria-hidden />
                  <h2 className="mt-4 text-lg font-extrabold">{title}</h2>
                  <p className="mt-2 leading-relaxed text-ink-soft">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="font-display text-[34px] leading-tight text-lagoon-900">From check-in to checkout</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="border-t-2 border-lagoon-700 pt-5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-extrabold text-brass-500 tabular">{i + 1}</span>
                    <Icon className="size-5 text-lagoon-700" aria-hidden />
                  </div>
                  <h3 className="mt-3 font-extrabold">{title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="bg-lagoon-900">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_1.4fr] lg:items-center">
              <div>
                <ShieldCheck className="size-8 text-brass-300" aria-hidden />
                <h2 className="mt-4 font-display text-[30px] leading-tight text-white">
                  Guest data stays with the hotel it belongs to.
                </h2>
              </div>
              <ul className="grid gap-6 text-[15px] leading-relaxed text-white/70 sm:grid-cols-2">
                <li>
                  <p className="font-bold text-white">Isolated by design</p>
                  Every property&apos;s data is fenced off in the database itself, not just in the app.
                </li>
                <li>
                  <p className="font-bold text-white">QR codes can&apos;t be misused</p>
                  A photographed QR code is useless without an active stay. Codes can be disabled or
                  replaced in a click.
                </li>
                <li>
                  <p className="font-bold text-white">Access ends at checkout</p>
                  Guest links expire with the stay, and checking a guest out ends them immediately.
                </li>
                <li>
                  <p className="font-bold text-white">Every change is recorded</p>
                  Check-ins, status changes and settings edits go into an audit log managers can review.
                </li>
              </ul>
            </div>
          </section>

          <section className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-16 sm:flex-row sm:items-center">
            <h2 className="max-w-lg text-2xl font-extrabold tracking-tight">
              Set up rooms, services and your team in an afternoon.
            </h2>
            <ButtonLink href="/signup" size="lg">
              Create your workspace
            </ButtonLink>
          </section>
        </main>
      )}

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-ink-faint">
          <Wordmark className="scale-90 opacity-70" />
          <p>Service operations for hotels, resorts and guesthouses.</p>
        </div>
      </footer>
    </div>
  );
}
