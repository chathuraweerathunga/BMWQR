import { describe, expect, it } from "vitest";
import { normalizeTimeZone, RESERVED_SLUGS, validateSettingsPatch } from "./service";

describe("validateSettingsPatch", () => {
  it("accepts well-formed branding and normalises colors", () => {
    expect(
      validateSettingsPatch({ primaryColor: "#1D6258", logoUrl: "https://cdn.example.com/logo.png" }),
    ).toEqual({ primaryColor: "#1d6258", logoUrl: "https://cdn.example.com/logo.png" });
  });

  it.each([
    [{ primaryColor: "red" }],
    [{ primaryColor: "#123456;background:url(x)" }],
    [{ logoUrl: "javascript:alert(1)" }],
    [{ logoUrl: "http://insecure.example/logo.png" }],
    [{ website: "ftp://example.com" }],
    [{ contactEmail: "not-an-email" }],
    [{ phone: "<script>" }],
    [{ welcomeMessage: "x".repeat(281) }],
  ])("rejects %j", (patch) => {
    expect(() => validateSettingsPatch(patch)).toThrow();
  });

  it("lets fields be cleared", () => {
    expect(validateSettingsPatch({ logoUrl: null, website: null })).toEqual({ logoUrl: null, website: null });
  });
});

describe("signup rules", () => {
  it("reserves slugs that collide with app routes", () => {
    for (const slug of ["login", "signup", "portal", "qr", "api"]) expect(RESERVED_SLUGS.has(slug)).toBe(true);
  });

  it("keeps only timezones the runtime knows", () => {
    expect(normalizeTimeZone("Asia/Colombo")).toBe("Asia/Colombo");
    expect(normalizeTimeZone("Mars/Olympus")).toBe("UTC");
    expect(normalizeTimeZone(null)).toBe("UTC");
  });
});
