import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

// Use a small N in tests so the suite stays fast; production code should
// keep the module's DEFAULT_N (16384).
const FAST_PARAMS = { N: 1024, r: 8, p: 1 };

describe("hashPassword / verifyPassword", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple", FAST_PARAMS);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple", FAST_PARAMS);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("same-password", FAST_PARAMS);
    const b = await hashPassword("same-password", FAST_PARAMS);
    expect(a).not.toBe(b);
    expect(await verifyPassword("same-password", a)).toBe(true);
    expect(await verifyPassword("same-password", b)).toBe(true);
  });

  it("stores the cost parameters alongside the hash", async () => {
    const hash = await hashPassword("p@ssw0rd", FAST_PARAMS);
    expect(hash).toMatch(/^scrypt\$1024\$8\$1\$[0-9a-f]+\$[0-9a-f]+$/);
  });

  it("rejects an empty password at hash time", async () => {
    await expect(hashPassword("", FAST_PARAMS)).rejects.toThrow();
  });

  it("treats a malformed stored hash as a non-match instead of throwing", async () => {
    await expect(verifyPassword("anything", "not-a-real-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "scrypt$abc$8$1$aa$bb")).resolves.toBe(false);
    await expect(verifyPassword("anything", "bcrypt$10$saltsaltsalt$hash")).resolves.toBe(false);
  });

  it("is case-sensitive and exact", async () => {
    const hash = await hashPassword("MyPassword1", FAST_PARAMS);
    expect(await verifyPassword("mypassword1", hash)).toBe(false);
    expect(await verifyPassword("MyPassword1 ", hash)).toBe(false);
  });
});
