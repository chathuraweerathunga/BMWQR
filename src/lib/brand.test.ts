import { describe, expect, it } from "vitest";
import { brandStyle, readableInk, sanitizeBrandColor } from "./brand";

describe("brand colors", () => {
  it("accepts only strict #rrggbb values", () => {
    expect(sanitizeBrandColor("#1D6258")).toBe("#1d6258");
    expect(sanitizeBrandColor("red")).toBeNull();
    expect(sanitizeBrandColor("#fff")).toBeNull();
    expect(sanitizeBrandColor("#123456; background:url(x)")).toBeNull();
    expect(sanitizeBrandColor(null)).toBeNull();
  });

  it("picks readable text for the background", () => {
    expect(readableInk("#0f3a35")).toBe("#ffffff");
    expect(readableInk("#f6ecd6")).toBe("#15201e");
  });

  it("produces no overrides for an invalid color", () => {
    expect(brandStyle("javascript:alert(1)")).toEqual({});
  });
});
