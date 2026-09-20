import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. Next.js hot-reloads server modules in
 * development, which would otherwise create a new PrismaClient (and a new
 * connection pool) on every edit. Caching it on `globalThis` avoids
 * exhausting the database's connection limit locally.
 *
 * This project's `generator client` block (prisma/schema.prisma) sets
 * `engineType = "client"`, which produces a pure JS/WASM client with no
 * native query-engine binary — it MUST be constructed with a driver
 * adapter rather than a `datasources.db.url` string. See prisma.config.ts
 * for why (the sandbox this was built in has `binaries.prisma.sh`
 * blocked, so the classic binary-engine distribution can't be used here
 * at all) and docs/ARCHITECTURE.md for the full explanation. This is
 * purely an engine-distribution detail — every query in the codebase
 * behaves identically to the classic client.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Type of the `tx` argument inside `prisma.$transaction(async (tx) => ...)`.
 *
 * TODO: once `npm run db:generate` has been run against a network with
 * access to binaries.prisma.sh (see docs/ARCHITECTURE.md's Prisma network
 * limitation note), replace this with the real derived type:
 *   Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]
 * Attempting that derivation against today's un-generated stub client
 * fails (`@prisma/client`'s placeholder declares `PrismaClient` as both a
 * `const` and a `type` in a way that doesn't resolve cleanly through
 * `Parameters<...>`), so this is deliberately just `any` until then —
 * every repository's transaction callback is annotated with this alias in
 * one place, so tightening it later is a one-line change here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaTransactionClient = any;
