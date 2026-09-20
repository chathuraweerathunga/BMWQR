import { z } from "zod";

/**
 * Validated process environment. Import `env` instead of reading
 * `process.env` directly anywhere in the app — that way a missing or
 * malformed variable fails fast at startup with a clear message instead of
 * surfacing as a confusing runtime error deep in a request handler.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required (see .env.example)"),
  AUTH_SECRET: z
    .string()
    .min(16, "AUTH_SECRET must be at least 16 characters"),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nCheck your .env against .env.example.`,
    );
  }
  return parsed.data;
}

// Skip strict validation during `next build`'s static analysis pass and in
// test files that intentionally construct their own fixtures — those set
// SKIP_ENV_VALIDATION explicitly rather than this file guessing at phases.
export const env: Env =
  process.env.SKIP_ENV_VALIDATION === "true"
    ? (process.env as unknown as Env)
    : loadEnv();
