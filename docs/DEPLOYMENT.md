# Deploying OneWeb (Vercel + Supabase)

The production setup is a Next.js app on Vercel talking to a Supabase
Postgres database. This is the checklist, in order.

## 1. Database (Supabase)

1. Apply every migration in `prisma/migrations/` **in folder order**, using
   the Supabase SQL editor or `psql -f`:
   - `00000000000000_init` — the schema
   - `20260925000000_lock_down_public_api` — **security-critical**: turns on
     row-level security with no policies and revokes Supabase's `anon` /
     `authenticated` roles. Without it, every table (including password
     hashes and guest data) is readable and writable by anyone holding the
     project's public anon key through Supabase's auto-generated REST API.
   - `20260925000100_guest_session_current_location`
2. Check **Advisors → Security** in the Supabase dashboard. The only
   remaining note should be *"RLS enabled, no policy"* (INFO) on each table.
   That is intended: OneWeb never uses the Supabase REST API, so nothing
   but the app's own server connection should reach the tables.

`prisma migrate deploy` can't be used here (the engine-less Prisma mode
can't introspect the database; see docs/ARCHITECTURE.md), which is why
migrations are applied as plain SQL.

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string → **Transaction pooler**. Put your database password in it. (The app uses the node-postgres driver adapter, which works with the pooler as-is.) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `APP_URL` | Your production origin, e.g. `https://oneweb.vercel.app` (no trailing slash). Guest activation links and printed QR codes point here, so set it before printing codes. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | From an Upstash Redis database (free tier is fine). Makes rate limits shared across Vercel's instances. Optional, but without it limits are per instance. |

**Why the pooler URL:** Supabase's direct host (`db.<ref>.supabase.co`) is
IPv6-only. Vercel's functions connect over IPv4, so with the direct host
every database call fails and signup shows a generic error. This is the
most likely cause of the September 2026 "signup doesn't work" problem: the
production database had never received a single connection from the
deployed site.

## 3. Deploy

Push to the branch Vercel builds from. The `postinstall` script runs
`prisma generate`; the build needs no database access.

## 4. After the first deploy

1. Visit `/signup`, create the real property's workspace.
2. Settings → set timezone and currency (signup takes the timezone from the
   browser, but check it), brand color, logo and reception phone.
3. Departments → Locations (use **Add a range** for numbered rooms) →
   Services → QR codes (**Create codes**, then print the sheet) → Team.
4. Check in a test guest, scan a room code with a phone, send a request, and
   handle it from the requests board.

## Security headers

Every response carries HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy` and COOP (`next.config.ts`). Every
page also gets a per-request nonce-based Content-Security-Policy
(`src/proxy.ts`), which is why all routes render dynamically.

## Seed data

`npm run db:seed` creates the demo "Ocean Pearl Resort" tenant with the
shared password `ChangeMe123!`. **Never run it against production.**
