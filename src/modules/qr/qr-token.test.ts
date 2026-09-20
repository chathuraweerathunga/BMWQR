import { describe, expect, it } from "vitest";
import { buildQrUrl, generateQrToken, hashQrToken, resolveQrScan } from "./qr-token";
import type {
  BusinessRecord,
  GuestSessionRecord,
  GuestStayRecord,
  QrCodeRecord,
  QrScanInput,
} from "./types";

describe("generateQrToken / hashQrToken", () => {
  it("generates a token whose hash matches hashQrToken", () => {
    const { token, tokenHash } = generateQrToken();
    expect(hashQrToken(token)).toBe(tokenHash);
  });

  it("generates unpredictable tokens, not sequential/guessable ids", () => {
    const a = generateQrToken().token;
    const b = generateQrToken().token;
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40); // 32 bytes, base64url
  });
});

describe("buildQrUrl", () => {
  it("builds an opaque-token URL, never a predictable path like /room/208", () => {
    const url = buildQrUrl("https://app.oneweb.example", "abc123XYZ_-");
    expect(url).toBe("https://app.oneweb.example/qr/abc123XYZ_-");
  });
});

const NOW = new Date("2026-01-10T12:00:00.000Z");
const BIZ_A = "biz_a";
const BIZ_B = "biz_b";

function baseQr(overrides: Partial<QrCodeRecord> = {}): QrCodeRecord {
  return { businessId: BIZ_A, locationId: "loc_room_208", status: "ACTIVE", ...overrides };
}

function baseBusiness(overrides: Partial<BusinessRecord> = {}): BusinessRecord {
  return { status: "ACTIVE", ...overrides };
}

function baseSession(overrides: Partial<GuestSessionRecord> = {}): GuestSessionRecord {
  return {
    id: "sess_1",
    businessId: BIZ_A,
    guestStayId: "stay_1",
    expiresAt: new Date("2026-01-11T12:00:00.000Z"),
    revokedAt: null,
    ...overrides,
  };
}

function baseStay(overrides: Partial<GuestStayRecord> = {}): GuestStayRecord {
  return {
    businessId: BIZ_A,
    status: "ACTIVE",
    checkOutAt: new Date("2026-01-12T11:00:00.000Z"),
    ...overrides,
  };
}

function baseInput(overrides: Partial<QrScanInput> = {}): QrScanInput {
  return {
    qrCode: baseQr(),
    business: baseBusiness(),
    guestSession: baseSession(),
    guestStay: baseStay(),
    now: NOW,
    ...overrides,
  };
}

describe("resolveQrScan: happy path", () => {
  it("allows a scan with an active QR, business, session, and stay", () => {
    const result = resolveQrScan(baseInput());
    expect(result).toEqual({
      ok: true,
      businessId: BIZ_A,
      locationId: "loc_room_208",
      guestStayId: "stay_1",
      guestSessionId: "sess_1",
    });
  });

  it("allows a scan for a business still in TRIAL status", () => {
    const result = resolveQrScan(baseInput({ business: baseBusiness({ status: "TRIAL" }) }));
    expect(result.ok).toBe(true);
  });
});

describe("resolveQrScan: denial branches", () => {
  it("denies when the token doesn't resolve to any QR code", () => {
    expect(resolveQrScan(baseInput({ qrCode: null }))).toEqual({
      ok: false,
      reason: "INVALID_TOKEN",
    });
  });

  it("denies a disabled QR code", () => {
    expect(
      resolveQrScan(baseInput({ qrCode: baseQr({ status: "DISABLED" }) })),
    ).toEqual({ ok: false, reason: "QR_DISABLED" });
  });

  it.each<["SUSPENDED" | "CANCELLED"]>([["SUSPENDED"], ["CANCELLED"]])(
    "denies when the business is %s",
    (status) => {
      expect(
        resolveQrScan(baseInput({ business: baseBusiness({ status }) })),
      ).toEqual({ ok: false, reason: "BUSINESS_INACTIVE" });
    },
  );

  it("denies when the business record failed to load", () => {
    expect(resolveQrScan(baseInput({ business: null }))).toEqual({
      ok: false,
      reason: "BUSINESS_INACTIVE",
    });
  });

  it("denies a scan with no guest session at all — a QR alone proves nothing", () => {
    expect(resolveQrScan(baseInput({ guestSession: null, guestStay: null }))).toEqual({
      ok: false,
      reason: "NO_GUEST_SESSION",
    });
  });

  it("denies a revoked guest session", () => {
    expect(
      resolveQrScan(baseInput({ guestSession: baseSession({ revokedAt: NOW }) })),
    ).toEqual({ ok: false, reason: "GUEST_SESSION_REVOKED" });
  });

  it("denies an expired guest session", () => {
    expect(
      resolveQrScan(
        baseInput({
          guestSession: baseSession({ expiresAt: new Date(NOW.getTime() - 1000) }),
        }),
      ),
    ).toEqual({ ok: false, reason: "GUEST_SESSION_EXPIRED" });
  });

  it("treats a session expiring at exactly `now` as expired (no off-by-one)", () => {
    expect(
      resolveQrScan(baseInput({ guestSession: baseSession({ expiresAt: NOW }) })),
    ).toEqual({ ok: false, reason: "GUEST_SESSION_EXPIRED" });
  });

  it("denies when the guest session belongs to a different business than the QR", () => {
    expect(
      resolveQrScan(baseInput({ guestSession: baseSession({ businessId: BIZ_B }) })),
    ).toEqual({ ok: false, reason: "TENANT_MISMATCH" });
  });

  it("denies when the guest stay is not ACTIVE", () => {
    expect(
      resolveQrScan(baseInput({ guestStay: baseStay({ status: "EXPIRED" }) })),
    ).toEqual({ ok: false, reason: "GUEST_STAY_NOT_ACTIVE" });
  });

  it("denies when the guest stay record failed to load", () => {
    expect(resolveQrScan(baseInput({ guestStay: null }))).toEqual({
      ok: false,
      reason: "GUEST_STAY_NOT_ACTIVE",
    });
  });

  it("denies when the stay's checkout time has passed, even if status hasn't flipped yet", () => {
    expect(
      resolveQrScan(
        baseInput({ guestStay: baseStay({ checkOutAt: new Date(NOW.getTime() - 1000) }) }),
      ),
    ).toEqual({ ok: false, reason: "GUEST_STAY_EXPIRED" });
  });

  it("denies when the guest stay belongs to a different business than the QR", () => {
    expect(
      resolveQrScan(baseInput({ guestStay: baseStay({ businessId: BIZ_B }) })),
    ).toEqual({ ok: false, reason: "TENANT_MISMATCH" });
  });

  it("photographing/sharing a QR code alone never grants access without a valid session", () => {
    // Simulates an outsider who has only the QR (thus a resolvable, ACTIVE
    // qrCode/business) but no session of their own.
    const result = resolveQrScan(
      baseInput({ guestSession: null, guestStay: null }),
    );
    expect(result.ok).toBe(false);
  });
});
