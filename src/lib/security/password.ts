import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

/**
 * A hand-written promise wrapper instead of `promisify(scryptCallback)`:
 * Node's `crypto.scrypt` typings declare multiple overloads (with and
 * without an options object), and `promisify` resolves to whichever one
 * TypeScript picks first — which drops the options-object overload we
 * need. Wrapping it explicitly keeps the options parameter properly typed.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Password hashing for staff (User.passwordHash) — the one secret in this
 * system that IS low-entropy and human-chosen, unlike the QR/guest-session
 * tokens in ./tokens.ts. Deliberately uses Node's built-in `crypto.scrypt`
 * rather than adding `argon2` or `bcrypt`: those require a native
 * compiled binary (a real risk in a sandboxed/restricted-network build
 * environment — see docs/ARCHITECTURE.md's Prisma engine note), whereas
 * scrypt is a memory-hard, well-vetted KDF built into Node with zero extra
 * dependencies. Revisit only if a compliance requirement specifically
 * mandates argon2.
 *
 * Stored format: `scrypt$N$r$p$<saltHex>$<hashHex>` — the cost parameters
 * travel with the hash so they can be tuned later without breaking
 * verification of existing hashes.
 */

const SCRYPT_PREFIX = "scrypt";
const DEFAULT_N = 16384; // CPU/memory cost (2^14) — scrypt's recommended interactive-login default
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

export async function hashPassword(
  password: string,
  params: ScryptParams = { N: DEFAULT_N, r: DEFAULT_R, p: DEFAULT_P },
): Promise<string> {
  if (password.length === 0) {
    throw new Error("Password must not be empty");
  }
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: params.N,
    r: params.r,
    p: params.p,
  });

  return [
    SCRYPT_PREFIX,
    params.N,
    params.r,
    params.p,
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

/**
 * Verifies a plaintext password against a stored hash. Returns false for
 * any malformed/unrecognized stored hash rather than throwing — a
 * corrupted or foreign-format hash should behave exactly like a wrong
 * password to the caller, never crash the login flow.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== SCRYPT_PREFIX) {
    return false;
  }
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }

  const actual = await scrypt(password, salt, expected.length, { N, r, p });

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
