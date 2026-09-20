import type { DefaultSession } from "next-auth";

// Augments next-auth's Session type so `session.user.id` is known to
// TypeScript everywhere `auth()` is called, matching what the `session`
// callback in src/auth.ts actually sets.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
  }
}
