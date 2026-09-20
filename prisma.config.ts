import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { defineConfig } from "prisma/config";

// Load .env manually here: prisma.config.ts is evaluated by the Prisma CLI
// before anything in src/ runs, so it can't rely on Next.js's automatic
// .env loading (or src/lib/env.ts's validation) — those only apply once
// the Next.js app itself boots.
import { config as loadDotenv } from "dotenv";
loadDotenv();

/**
 * Sandbox note (see docs/ARCHITECTURE.md): this project's dev sandbox has
 * `binaries.prisma.sh` blocked by network policy, so the classic Prisma
 * CLI workflow (which downloads a native schema-engine + query-engine
 * binary per commit hash) cannot run here at all. This config switches
 * Prisma onto its engine-less "js" mode instead:
 *   - `engine: "js"` + `adapter` below give the CLI a driver adapter
 *     (`@prisma/adapter-pg`, itself just an `npm`-installed package — no
 *     binary download) to use for schema/migrate operations, instead of
 *     the native schema-engine binary.
 *   - `prisma/schema.prisma`'s `generator client` block sets
 *     `previewFeatures = ["driverAdapters"]` and `engineType = "client"`,
 *     so the generated Prisma Client is pure JS/WASM (bundled inside the
 *     `@prisma/client` npm package) and never needs the native
 *     query-engine binary either.
 * `src/lib/prisma.ts` constructs the same `PrismaPg` adapter at runtime.
 * None of this is tenant-isolation- or security-relevant — it's purely an
 * engine-distribution mechanism; the resulting client behaves identically
 * to the classic one for every query in this codebase.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  experimental: {
    adapter: true,
  },
  engine: "js",
  adapter: async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required (see .env.example)");
    }
    return new PrismaPg({ connectionString });
  },
});
