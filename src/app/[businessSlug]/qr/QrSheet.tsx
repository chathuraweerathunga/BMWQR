"use client";

/* eslint-disable @next/next/no-img-element -- generated data: URL images */
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { QrReveal } from "./types";

function fileName(locationName: string) {
  return `qr-${locationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
}

/**
 * Printable cards for newly created QR codes: the code, where it goes, and
 * one line telling guests what it does. Print the page or download each
 * image; these can't be shown again once you leave, only replaced.
 */
export function QrSheet({ codes, businessName, message }: { codes: QrReveal[]; businessName: string; message?: string }) {
  if (codes.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info" title={message ?? `${codes.length} new QR code${codes.length === 1 ? "" : "s"} ready`}>
        Print or download them now. For security the codes can&apos;t be shown again after you leave this page; you can
        only replace them.
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Print {codes.length === 1 ? "card" : `all ${codes.length} cards`}
        </Button>
      </div>
      <ul className="print-area grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 print:grid-cols-3">
        {codes.map((code) => (
          <li
            key={code.url}
            className="print-card flex flex-col items-center gap-2 rounded-[var(--radius-panel)] border border-line bg-white p-4 text-center"
          >
            <p className="text-xs font-semibold text-ink-faint">{businessName}</p>
            <img src={code.imageDataUrl} alt={`QR code for ${code.locationName}`} className="aspect-square w-full max-w-44" />
            <p className="text-base font-extrabold text-ink">{code.locationName}</p>
            <p className="text-xs leading-snug text-ink-soft">Scan with your phone camera for guest services</p>
            <a
              href={code.imageDataUrl}
              download={fileName(code.locationName)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-lagoon-700 hover:underline print:hidden"
            >
              <Download className="size-3.5" aria-hidden />
              Download
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
