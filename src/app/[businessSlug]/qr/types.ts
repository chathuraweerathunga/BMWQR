/** A freshly created QR code, available only in the response that made it:
 * the raw token is never stored, only its hash. */
export interface QrReveal {
  locationName: string;
  url: string;
  imageDataUrl: string;
}

export interface QrRevealState {
  codes: QrReveal[];
  error?: string;
  /** Shown above the sheet, e.g. "Replaced the code for Room 208". */
  message?: string;
}
