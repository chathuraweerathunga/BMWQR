import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, MessageSquarePlus, Phone } from "lucide-react";
import { loadGuestPortal } from "@/lib/guest-portal";
import { GUEST_ERROR_MESSAGES } from "@/lib/guest-context";
import { listActiveServicesForBusiness } from "@/modules/services/repository";
import { GuestNotice, GuestShell } from "@/components/guest/GuestShell";
import { ServiceIcon } from "@/components/guest/ServiceIcon";
import { Alert } from "@/components/ui/Alert";
import { formatDate, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Guest services", robots: { index: false } };

const NOTICE_TITLE: Record<string, string> = {
  GUEST_STAY_EXPIRED: "Thank you for staying",
  RATE_LIMITED: "One moment",
  BUSINESS_INACTIVE: "Services unavailable",
  SIGNED_OUT: "Signed out",
};

function greeting(date: Date, timeZone: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(date));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Guest services home: who we think you are, where we'll send help, and
 * every service the property offers as a large tap target.
 */
export default async function GuestPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; scanned?: string }>;
}) {
  const { error, scanned } = await searchParams;
  const result = await loadGuestPortal();

  if (!result.ok) {
    const code = error && GUEST_ERROR_MESSAGES[error] ? error : result.errorCode;
    return (
      <GuestNotice
        title={NOTICE_TITLE[code] ?? "Guest services"}
        message={GUEST_ERROR_MESSAGES[code] ?? GUEST_ERROR_MESSAGES.NO_GUEST_SESSION}
      />
    );
  }

  const { portal } = result;
  const services = await listActiveServicesForBusiness(portal.actor.businessId);
  const tz = portal.branding.timezone;
  const helpAt = portal.scannedLocation ?? portal.stayLocation;
  const firstName = portal.guestName?.split(/\s+/)[0];

  return (
    <GuestShell branding={portal.branding}>
      <section className="pt-7">
        <h1 className="font-display text-[32px] leading-tight text-ink">
          {greeting(new Date(), tz)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {portal.branding.welcomeMessage ?? "What can we bring you, fix, or arrange?"}
        </p>
      </section>

      {error && GUEST_ERROR_MESSAGES[error] && (
        <Alert tone="error" className="mt-5">
          {GUEST_ERROR_MESSAGES[error]}
        </Alert>
      )}
      {scanned && portal.scannedLocation && (
        <Alert tone="success" className="mt-5">
          You&apos;re at {portal.scannedLocation.name}. Requests will be sent there.
        </Alert>
      )}

      <div className="mt-5 flex items-center gap-3 rounded-[var(--radius-panel)] bg-[var(--brand-soft)] px-4 py-3">
        <MapPin className="size-5 shrink-0 text-[var(--brand)]" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-ink">
          {helpAt ? (
            <>
              Help goes to <span className="font-bold">{helpAt.name}</span>
            </>
          ) : (
            "Scan the QR code in your room so we know where to come."
          )}
        </p>
        <p className="shrink-0 text-right text-xs text-ink-soft">
          Checkout
          <br />
          <span className="font-semibold text-ink">
            {formatDate(portal.checkOutAt, tz)}, {formatTime(portal.checkOutAt, tz)}
          </span>
        </p>
      </div>

      <section className="mt-8" aria-labelledby="services-heading">
        <h2 id="services-heading" className="text-sm font-bold text-ink-soft">
          Services
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {services.map((service: { id: string; name: string; icon: string | null; estimatedMinutes: number | null }) => (
            <li key={service.id}>
              <Link
                href={`/portal/request/${service.id}`}
                className="flex h-full min-h-32 flex-col justify-between gap-4 rounded-[var(--radius-panel)] border border-line bg-surface p-4 transition-colors hover:border-[var(--brand)] active:bg-sunken"
              >
                <span className="grid size-11 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                  <ServiceIcon icon={service.icon} name={service.name} className="size-[22px]" />
                </span>
                <span>
                  <span className="block font-bold leading-snug text-ink">{service.name}</span>
                  {service.estimatedMinutes ? (
                    <span className="mt-0.5 block text-xs text-ink-faint">About {service.estimatedMinutes} min</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
          <li className={services.length % 2 === 0 ? "col-span-2" : undefined}>
            <Link
              href="/portal/request/other"
              className="flex h-full min-h-20 items-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-line-strong bg-surface p-4 hover:border-[var(--brand)]"
            >
              <MessageSquarePlus className="size-[22px] text-[var(--brand)]" aria-hidden />
              <span className="font-bold text-ink">Something else</span>
            </Link>
          </li>
        </ul>
      </section>

      {portal.branding.phone && (
        <a
          href={`tel:${portal.branding.phone.replace(/[^+\d]/g, "")}`}
          className="mt-8 flex items-center justify-center gap-2 rounded-[var(--radius-panel)] border border-line bg-surface py-3.5 text-sm font-semibold text-ink"
        >
          <Phone className="size-4" aria-hidden />
          Call reception
        </a>
      )}
    </GuestShell>
  );
}
