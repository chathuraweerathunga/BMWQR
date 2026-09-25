"use client";

/* eslint-disable @next/next/no-img-element -- previewing a tenant-supplied logo URL */
import { useState } from "react";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { brandStyle, sanitizeBrandColor } from "@/lib/brand";

/**
 * Brand color, logo and welcome message, with a live preview of the guest
 * portal's header so owners see exactly what guests will see.
 */
export function BrandingFields({
  businessName,
  primaryColor,
  logoUrl,
  welcomeMessage,
}: {
  businessName: string;
  primaryColor: string | null;
  logoUrl: string | null;
  welcomeMessage: string | null;
}) {
  const [color, setColor] = useState(primaryColor ?? "#144c45");
  const [logo, setLogo] = useState(logoUrl ?? "");
  const [welcome, setWelcome] = useState(welcomeMessage ?? "");
  const safeLogo = /^https:\/\//.test(logo) ? logo : null;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-4">
        <Field label="Brand color" htmlFor="primaryColor" hint="Used for the guest portal header and buttons.">
          <div className="flex gap-2">
            <input
              type="color"
              aria-label="Pick brand color"
              value={sanitizeBrandColor(color) ?? "#144c45"}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-14 cursor-pointer rounded-[var(--radius-control)] border border-line-strong bg-surface p-1"
            />
            <Input
              id="primaryColor"
              name="primaryColor"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              pattern="#[0-9a-fA-F]{6}"
              maxLength={7}
              className="font-semibold tabular"
            />
          </div>
        </Field>
        <Field label="Logo address" htmlFor="logoUrl" optional hint="A square image link starting with https://">
          <Input id="logoUrl" name="logoUrl" type="url" value={logo} onChange={(e) => setLogo(e.target.value)} maxLength={500} />
        </Field>
        <Field label="Welcome message" htmlFor="welcomeMessage" optional hint="Shown under the guest's greeting.">
          <Textarea
            id="welcomeMessage"
            name="welcomeMessage"
            rows={2}
            maxLength={280}
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
            placeholder="What can we bring you, fix, or arrange?"
          />
        </Field>
      </div>

      <div aria-hidden className="overflow-hidden rounded-[var(--radius-sheet)] border border-line bg-paper shadow-[var(--shadow-panel)]" style={brandStyle(color)}>
        <p className="bg-sunken px-4 py-1.5 text-center text-[11px] font-semibold text-ink-faint">Guest portal preview</p>
        <div className="flex items-center gap-2.5 bg-[var(--brand)] px-4 py-3 text-[var(--brand-ink)]">
          {safeLogo ? (
            <img src={safeLogo} alt="" className="size-8 rounded-full bg-white object-contain p-0.5" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid size-8 place-items-center rounded-full bg-white/15 font-display">{businessName.charAt(0)}</span>
          )}
          <span className="truncate font-display">{businessName}</span>
        </div>
        <div className="p-4">
          <p className="font-display text-xl text-ink">Good evening, John</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{welcome || "What can we bring you, fix, or arrange?"}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {["Extra towels", "Room service"].map((s) => (
              <div key={s} className="rounded-xl border border-line bg-surface p-2.5">
                <span className="block size-6 rounded-full bg-[var(--brand-soft)]" />
                <span className="mt-2 block text-xs font-bold">{s}</span>
              </div>
            ))}
          </div>
          <span className="mt-3 block rounded-lg bg-[var(--brand)] py-2 text-center text-xs font-bold text-[var(--brand-ink)]">
            Send request
          </span>
        </div>
      </div>
    </div>
  );
}
