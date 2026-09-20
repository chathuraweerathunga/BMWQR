# OneWeb

Multi-tenant customer-service and business-operations SaaS. One codebase,
many businesses, strict tenant isolation. See
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the design decisions
behind this milestone (tenant isolation strategy, RBAC, request state
machine, QR/guest-session security, analytics, rate limiting).

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS · Prisma ·
PostgreSQL · Vitest.

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and AUTH_SECRET

npm run db:generate
npm run db:migrate -- --name init
npm run db:seed      # creates the "Ocean Pearl Resort" example tenant

npm run dev
```

Prisma runs in engine-less "js" mode here (`prisma.config.ts` +
`@prisma/adapter-pg` + `engineType = "client"` in
`prisma/schema.prisma`) rather than the classic native-binary engines —
see docs/ARCHITECTURE.md for why and what that changes. This has been
run and verified end-to-end (migrations applied, seed run, dev server
serving the guest portal and staff dashboard against a real Postgres
database) against local PostgreSQL 16.

Two ways to try it:

- **From scratch**: visit `/signup`, create a business, and you'll land
  signed in as its owner at `/{slug}/dashboard`. From there, in the order
  you'd actually need them: `Departments` → `Locations` (rooms, tables,
  etc. — supports a parent location for a Building→Floor→Room hierarchy)
  → `Services` (link one to a department) → `QR Codes` (needs a location
  to exist first) → `Staff` (invite a manager/staff member — they get a
  one-time temporary password to sign in with) → `Check-in` (check in a
  guest and get their activation link) → `Manager` for the KPI dashboard,
  `Audit log` for a record of everything above, `Settings` for branding/
  contact info. Signing in again at `/` shows every business your account
  belongs to.
- **From the seed data**: open the guest activation link `db:seed` prints
  (logs into the guest portal), scan one of the printed `/qr/...` paths,
  submit a request from `/portal`, leave feedback at `/portal/feedback`,
  and sign in at `/login` as `manager@oceanpearl.example` / `ChangeMe123!`
  to accept/complete it from `/ocean-pearl-resort/dashboard` and see it
  reflected on `/ocean-pearl-resort/manager`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Run the unit test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run db:generate` | Generate the Prisma Client from `prisma/schema.prisma` |
| `npm run db:migrate` | Create/apply a Prisma migration (needs `prisma migrate dev` to work against your Postgres — see the note below if it doesn't) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed the "Ocean Pearl Resort" example tenant |

> If `npm run db:migrate` fails with `Column type 'name'/'char' could
> not be deserialized from the database`, your environment has hit the
> same schema-introspection bug documented in docs/ARCHITECTURE.md — use
> `npx prisma migrate diff --from-empty --to-schema-datamodel
> prisma/schema.prisma --script > migration.sql`, apply it with `psql -f`,
> and record it in `_prisma_migrations` by hand instead (see that doc for
> the exact steps; this is what this repo's own `prisma/migrations/`
> directory was produced with).

## Project layout

```
prisma.config.ts         Prisma CLI config — engine-less "js" mode via @prisma/adapter-pg
                         (see docs/ARCHITECTURE.md's "Prisma CLI's native engine binaries"
                         section for why, and for the migrate-diff workflow this implies)
prisma/schema.prisma     Tenant-safe data model (see docs/ARCHITECTURE.md)
prisma/seed.ts           Seeds the "Ocean Pearl Resort" example tenant
src/auth.ts              Auth.js (staff login) configuration
src/lib/                 Cross-cutting: env validation, Prisma client, crypto,
                         sessions, errors, rate limiting, guest-context resolution
src/modules/auth/        Roles, permissions, the centralized authorize() entry point
src/modules/requests/    Request lifecycle state machine + service layer
src/modules/qr/          QR token generation, scan resolution, scan orchestration,
                         and staff-facing QR management (create/regenerate/enable/disable)
src/modules/guest-sessions/  Guest session token + validity rules + repository
src/modules/guest-stays/ Check-in/check-out service (issues the guest's activation link)
src/modules/feedback/    Guest feedback submission + business-facing summaries
src/modules/analytics/   Manager-dashboard KPIs — pure timing math + tenant-scoped queries
src/modules/audit/       Best-effort audit-log writing (logAudit) + business-scoped listing/viewing
src/modules/business/    Business signup, core identity fields, and branding/contact settings
src/modules/locations/   Generic hierarchical Location model — management service + type/status unions
src/modules/departments/ Department create/rename
src/modules/services/    Service create/activate/deactivate, linked to a department
src/modules/staff/       Staff invite (temp-password reveal)/disable + business-switcher lookup
src/modules/guests/repository.ts
                         Tenant-scoped Prisma data access
src/app/qr/[token]/      Guest QR scan endpoint (rate-limited)
src/app/portal/          Guest portal: request submission, feedback, activation
src/app/login/           Staff sign-in page (rate-limited, supports ?next=)
src/app/signup/          Public business signup (rate-limited)
src/app/page.tsx         Landing page / business switcher (signed-in users see their businesses)
src/app/[businessSlug]/  Staff/manager UI: dashboard, check-in, locations, departments, services,
                         staff, qr, manager, audit, settings — access-guarded by the shared
                         layout via getStaffContext()
docs/ARCHITECTURE.md     Design decisions, trade-offs, and what's next
```

Business logic lives in `src/modules/*`, organized by domain — not inside
page components, and not in a catch-all `utils.ts`.
