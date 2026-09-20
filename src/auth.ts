import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByEmail } from "@/modules/staff/repository";
import { verifyPassword } from "@/lib/security/password";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_ATTEMPT_WINDOW_MS = 5 * 60_000;

/**
 * Staff authentication (Auth.js / next-auth v5). Deliberately:
 *   - Credentials provider only, for now — a staff member's identity is a
 *     User row with a scrypt password hash (see lib/security/password.ts).
 *     Add OAuth providers later without touching anything downstream of
 *     `auth()`.
 *   - JWT session strategy, not a database adapter — there is no
 *     Session/Account table in the schema, and none is needed yet (no
 *     "sign in with Google" token to persist, no server-side session
 *     revocation requirement beyond what a short JWT lifetime already
 *     gives). Revisit if a "log out all devices" requirement appears.
 *
 * `authorize()` here returns only a minimal identity (id/email/name) — it
 * deliberately does NOT decide which business the user is acting on or
 * with what role. A signed-in session answers "who is this person"; which
 * `StaffActor` they get for a specific request is resolved separately, per
 * request, from an ACTIVE BusinessMembership (see lib/session.ts). Baking
 * a businessId/role into the JWT would let a user's access change (e.g.
 * a disabled membership) lag behind reality until their token expires.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email =
          typeof credentials?.email === "string" ? credentials.email : undefined;
        const password =
          typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!email || !password) return null;

        // Rate-limited by IP+email together: an IP-only key would let one
        // attacker's lockout collide with unrelated guests behind the same
        // NAT, and an email-only key would let an attacker rotate IPs to
        // brute-force one account — both dimensions matter here (project
        // instructions section 32).
        const ip = getClientIp(request.headers);
        const limitResult = rateLimit(
          `login:${ip}:${email.toLowerCase()}`,
          LOGIN_ATTEMPT_LIMIT,
          LOGIN_ATTEMPT_WINDOW_MS,
        );
        if (!limitResult.allowed) return null;

        const user = await findUserByEmail(email);

        // Run a verification against a dummy hash even when the user
        // doesn't exist, so "no such user" and "wrong password" take
        // roughly the same amount of time — a cheap mitigation against
        // using login timing to enumerate valid staff emails.
        const DUMMY_HASH =
          "scrypt$16384$8$1$0000000000000000000000000000000000000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
        const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      return session;
    },
  },
});
