import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it("keeps same-site relative paths", () => {
    expect(safeRedirectPath("/ocean-pearl-resort/dashboard")).toBe("/ocean-pearl-resort/dashboard");
    expect(safeRedirectPath("/a/b?x=1#y")).toBe("/a/b?x=1#y");
  });

  it.each([
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/\t/evil.example",
    "evil",
    "",
  ])("rejects %j", (candidate) => {
    expect(safeRedirectPath(candidate)).toBe("/");
  });

  it("uses the fallback when nothing is given", () => {
    expect(safeRedirectPath(undefined, "/home")).toBe("/home");
  });
});
