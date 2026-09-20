import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * Shared primitives for every "opaque bearer secret" in the system: QR scan
 * tokens and guest session tokens. Both share the same shape and the same
 * rules, so the logic lives here once instead of being copy-pasted.
 *
 * Why SHA-256 and not bcrypt/argon2: those are for LOW-ENTROPY secrets
 * (human-chosen passwords) where the threat is offline brute-forcing a
 * small search space, so hashing is deliberately made slow. A QR/session
 * token here is 256 bits of `crypto.randomBytes` output — the search space
 * is astronomically large, so a slow hash buys nothing and would only
 * slow down every legitimate lookup. A fast, deterministic hash is the
 * correct tool: it lets the database index and look up by `tokenHash`
 * directly, and the raw token is still never stored or logged.
 */

const DEFAULT_TOKEN_BYTES = 32; // 256 bits of entropy

/**
 * Generates a new cryptographically random, URL-safe token plus the hash
 * that should be persisted. The raw `token` is returned exactly once by
 * whichever caller creates it (e.g. embedded in a QR image URL, or set in
 * a guest's session cookie) and must never be written to the database or
 * to logs — only `tokenHash` is stored.
 */
export function generateSecureToken(
  byteLength: number = DEFAULT_TOKEN_BYTES,
): { token: string; tokenHash: string } {
  const token = randomBytes(byteLength).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

/** Deterministic SHA-256 hash (hex) of a raw token, for storage/lookup. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Constant-time equality check for two hex-encoded hashes. Not strictly
 * required when comparisons happen via a database unique-index lookup (the
 * usual path here), but provided for any code path that compares two
 * already-computed hashes in memory, so a future caller doesn't reach for
 * `===` and reintroduce a timing side channel.
 */
export function safeCompareHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
