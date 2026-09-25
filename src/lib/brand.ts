/**
 * Tenant brand colors, made safe to put into a `style` attribute. Only a
 * strict #rrggbb value is ever used: anything else falls back to the
 * platform color, so a stored setting can't inject CSS.
 */
import type { CSSProperties } from "react";

const HEX = /^#([0-9a-f]{6})$/i;

export function sanitizeBrandColor(value: string | null | undefined): string | null {
  return value && HEX.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Text color with the better contrast on the given background. */
export function readableInk(hex: string): "#ffffff" | "#15201e" {
  const l = relativeLuminance(hex);
  const contrastWhite = 1.05 / (l + 0.05);
  const contrastDark = (l + 0.05) / (relativeLuminance("#15201e") + 0.05);
  return contrastWhite >= contrastDark ? "#ffffff" : "#15201e";
}

/** CSS custom properties for a tenant's brand, or none for the default. */
export function brandStyle(primaryColor: string | null | undefined): CSSProperties {
  const brand = sanitizeBrandColor(primaryColor);
  if (!brand) return {};
  return {
    ["--brand" as string]: brand,
    ["--brand-ink" as string]: readableInk(brand),
    ["--brand-soft" as string]: `color-mix(in srgb, ${brand} 10%, white)`,
  };
}
