import { prisma } from "@/lib/prisma";
import { generateQrToken, hashQrToken } from "./qr-token";

export interface CreateQrCodeInput {
  businessId: string;
  locationId: string;
  label?: string | null;
}

/** Creates a QR code and returns the RAW token exactly once — the caller
 * must embed it into the printed/displayed QR image immediately and then
 * discard it. Only the hash is persisted (see qr-token.ts). */
export async function createQrCode(input: CreateQrCodeInput) {
  const { token, tokenHash } = generateQrToken();
  const qrCode = await prisma.qRCode.create({
    data: {
      businessId: input.businessId,
      locationId: input.locationId,
      tokenHash,
      label: input.label ?? null,
    },
  });
  return { qrCode, token };
}

/**
 * The scan-time lookup: resolves a scanned raw token to its QRCode +
 * Business, by hash — never by any client-supplied id. Returns null if no
 * QR matches, which `resolveQrScan()` treats as `INVALID_TOKEN`.
 */
export async function findQrCodeByToken(rawToken: string) {
  const tokenHash = hashQrToken(rawToken);
  return prisma.qRCode.findUnique({
    where: { tokenHash },
    include: { business: true, location: true },
  });
}

export async function recordScan(qrCodeId: string) {
  return prisma.qRCode.update({
    where: { id: qrCodeId },
    data: { scanCount: { increment: 1 }, lastScannedAt: new Date() },
  });
}

export async function setQrCodeStatus(
  businessId: string,
  qrCodeId: string,
  status: "ACTIVE" | "DISABLED",
) {
  return prisma.qRCode.updateMany({ where: { id: qrCodeId, businessId }, data: { status } });
}

/** Issues a brand-new token for an existing QR row (e.g. after a print-out
 * is reported lost) — same physical/printed record id, new secret, old
 * token immediately stops resolving. */
export async function regenerateQrCode(businessId: string, qrCodeId: string) {
  const { token, tokenHash } = generateQrToken();
  const result = await prisma.qRCode.updateMany({
    where: { id: qrCodeId, businessId },
    data: { tokenHash, status: "ACTIVE" },
  });
  if (result.count === 0) return null;
  return { token };
}

export async function listQrCodesForBusiness(businessId: string) {
  return prisma.qRCode.findMany({
    where: { businessId },
    include: { location: true },
    orderBy: { createdAt: "desc" },
  });
}
