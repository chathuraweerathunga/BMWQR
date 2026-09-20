# OneWeb — Architecture Notes

This document records the decisions made while building the foundation
layer, why they were made, and what's deliberately deferred. Read this
before extending the schema or the security modules.

## Milestone 1 — Foundation

1. A Next.js 16 (App Router) + TypeScript (strict) + Tailwind project.
2. A tenant-safe Prisma schema covering the core hotel-first MVP entities.
3. A centralized RBAC core (`src/modules/auth`) — the only place role and
   tenant authorization decisions are made.
4. The request lifecycle state machine (`src/modules/requests`).
5. The QR-scan resolution checklist and guest-session security primitives
   (`src/modules/qr`, `src/modules/guest-sessions`, `src/lib/security`).
6. 79 unit tests covering all of the above, all passing.

## Milestone 2 — Data access, auth, and the first end-to-end flow

1. **Password hashing** (`src/lib/security/password.ts`) — Node's built-in
   `crypto.scrypt`, not `argon2`/`bcrypt`. Those need a native compiled
   binary, a real risk in a sandboxed/restricted-network build environment
   (see the Prisma engine note below, which is exactly that failure mode);
   scrypt is a memory-hard, well-vetted KDF with zero extra dependencies.
   Cost parameters travel with the stored hash so they can be tuned later.
2. **Repository layer**, one file per module
   (`src/modules/*/repository.ts`) — every query scoped by `businessId` in
   its `WHERE` clause, so a wrong or spoofed id and a cross-tenant id are
   both simply "not found" (see `NotFoundError` in `src/lib/errors.ts`).
   Route handlers and services never call `prisma.*` directly.
3. **Request service layer** (`src/modules/requests/service.ts`) — the
   glue between `authorize()`, the state machine, and the repository.
   Every transition (`acceptRequest`, `startRequest`, `completeRequest`,
   `rejectRequest`, `cancelRequest`) loads the request tenant-scoped,
   authorizes, validates the transition, then persists the new status and
   a history row with **optimistic concurrency**: `applyStatusChange`'s
   `UPDATE` includes the expected `fromStatus` in its `WHERE` clause, so
   two staff accepting the same request at once results in one success and
   one `ConcurrentUpdateError`, never a silently overwritten decision.
4. **Staff authentication** (`src/auth.ts`, Auth.js v5 beta) — Credentials
   provider + JWT session strategy (no adapter/session table — there's
   nothing to persist yet and no revocation requirement beyond a short
   token lifetime). A signed-in session only proves *identity*; it is
   deliberately not where role/business access lives. `src/lib/session.ts`
   (`requireStaffActor(businessId)`) is the bridge: it re-resolves an
   ACTIVE `BusinessMembership` per request, so a disabled membership takes
   effect immediately rather than waiting for a JWT to expire. "Not signed
   in" and "signed in but no membership at this business" are the same
   `AuthenticationError` on purpose — an authenticated user can't use this
   to probe which businesses exist.
5. **The guest QR-scan → activation → request flow, end to end**:
   - `modules/guest-stays/service.ts: checkInGuest()` — reception's
     check-in creates the Guest + GuestStay + the guest's **first**
     GuestSession together, and returns an activation URL embedding that
     session's raw token. This *is* the "secure link... at check-in" from
     project instructions section 5 — no new schema was needed, it reuses
     the GuestSession infrastructure from Milestone 1.
   - `app/portal/activate/route.ts` — the only route that turns a raw
     session token from a URL into the guest's cookie. Every other
     guest-facing code path only ever reads the cookie.
   - `app/qr/[token]/route.ts` — the scan endpoint. Pure HTTP plumbing
     around `modules/qr/scan-service.ts: scanQr()`, which loads exactly
     what `resolveQrScan()` needs and, only on success, records the scan
     and touches the session's last-seen time.
   - `app/portal/page.tsx` — a deliberately unstyled but functional guest
     portal: validates the session, lists active services, and submits a
     request via `createGuestRequest`. Real branding/design is later
     milestone work; this exists to prove the flow, not to look finished.
   - `src/lib/guest-cookie.ts` centralizes the cookie name and security
     flags (`httpOnly`, `secure` in production, `sameSite: lax`) so every
     route that touches it agrees, rather than each route hand-rolling
     its own `cookies.set(...)` options.
6. **Seed script** (`prisma/seed.ts`, `npm run db:seed`) — builds the
   "Ocean Pearl Resort" example tenant entirely through this codebase's
   own repository/service functions (not raw `prisma.*`), so seeding
   doubles as a smoke test that those functions compose correctly:
   business → departments → locations (with a Building→Floor→Room
   hierarchy) → services → staff → QR codes → a checked-in guest with a
   working activation link.
7. 7 more unit tests (password hashing) — **86 total**, all passing.
   `tsc --noEmit`, ESLint, and `next build`'s own TypeScript/compilation
   pass are all clean (see the Prisma limitation below for why `next
   build` doesn't fully complete in this sandbox).

Deliberately **not** in this milestone: the staff/manager dashboards, the
"business switcher" UI for a user who belongs to multiple businesses,
notifications, analytics, rate limiting on the QR scan route, and QR-code
management UI (create/disable/regenerate — the repository functions exist,
nothing calls them from a route yet). See "Next milestone" below.

## Milestone 3 — Staff/manager UI, feedback, analytics, audit, rate limiting, signup

Everything below was built and verified (`tsc --noEmit`, ESLint, Vitest,
`next build`'s compile/type-check phase) in the same sandbox as Milestones
1–2, with the same Prisma-generate limitation (see below) — none of it has
run against a real database yet.

1. **Business context resolution** (`src/lib/staff-context.ts`,
   `app/[businessSlug]/layout.tsx`) — `getStaffContext(businessSlug)`,
   wrapped in React's `cache()` so it resolves once per request even when
   several server components on the same page call it, is the single place
   that turns a URL slug + the signed-in user into a `{ business, actor }`
   pair. It 404s on an unknown slug and redirects to `/login?next=...` when
   unauthenticated or not a member — never a client-supplied businessId.
   The shared layout renders nav links and is itself the access guard for
   every route nested under `[businessSlug]`.
2. **Staff dashboard** (`app/[businessSlug]/dashboard/page.tsx`) —
   tenant-scoped, role-aware request queue. A `STAFF` actor's queue is
   filtered to "unassigned or assigned to me" at the *query* level for UX
   (`listRequestsForBusiness`'s `unassignedOrOwnedBy` filter), but the real
   security boundary is still `authorize()` inside each transition — the
   query filter is a convenience, not a trust boundary. Inline per-row
   server-action forms call `acceptRequest`/`startRequest`/etc. directly.
3. **QR code management UI** (`modules/qr/service.ts`,
   `app/[businessSlug]/qr/`) — `createQr`/`regenerateQr` render an actual
   scannable image (`qrcode` npm package, `QRCode.toDataURL`) and return it
   embedded in a `data:` URI, never a persisted file. Both flows use
   `useActionState` client components (`QrCreateForm.tsx`,
   `RegenerateButton.tsx`) specifically so the raw token/URL can be shown
   inline, once, without ever appearing in a redirect URL (and thus browser
   history) — the same "shown once, never persisted or logged" discipline
   as the check-in activation link.
4. **Guest check-in/check-out UI** (`app/[businessSlug]/checkin/`) — same
   once-only-reveal pattern for the activation link returned by
   `checkInGuest()`. Lists currently-active stays with a one-click checkout
   calling `checkOutGuestStay()`.
5. **Guest feedback** (`modules/feedback/`, `app/portal/feedback/`) — new
   module. `submitGuestFeedback()` validates rating 1–5 and, when a
   `requestId` is given, verifies it belongs to the *same* guest (never
   trusts a client-supplied ownership claim) before writing. Extracted the
   session-cookie → `GuestActor` resolution that used to live inline in
   `app/portal/page.tsx` into a shared `src/lib/guest-context.ts` — both
   guest-facing pages now share one definition of "is this session valid"
   and one error-message table.
6. **Manager dashboard / analytics** (`modules/analytics/`,
   `app/[businessSlug]/manager/`) — plain, tenant-scoped Postgres queries
   per project instructions section 24 (no warehouse, no event pipeline).
   `modules/analytics/metrics.ts` is a **pure**, dependency-free module
   (average response/completion time, overdue classification) so the
   timing math is unit-tested without touching a database — same pattern
   as the request state machine. "Overdue" falls back to a flat
   age-threshold (`DEFAULT_OVERDUE_MINUTES = 60`) when a request has no
   `dueAt` set, since nothing in the app populates `dueAt` yet
   (`Service.estimatedMinutes` → per-request `dueAt` at creation time is
   good V2 follow-up work, tracked below).
7. **Audit logging** (`modules/audit/`) — `logAudit(actor, params)` is
   best-effort: a failure is logged to the server console and swallowed,
   never thrown, so audit logging can never take down the operation it
   describes. Wired into the write paths that already existed: QR
   create/regenerate/enable/disable, guest check-in/check-out, and every
   request status transition (covers "assigned" via the `claimForStaff`
   flag on `accept`, and "status changed" generally). Staff
   create/disable, location/service management, and billing changes are
   **not yet wired** because those write paths don't have staff-facing UI
   yet either — audit each one when its UI is built, not before.
8. **Rate limiting** (`src/lib/rate-limit.ts`) — an in-process, fixed-window
   limiter (`Map`-backed), explicitly **not** Redis-backed yet (see the
   file's own top comment: correct for one server instance, becomes wrong
   the moment there's more than one, with the exact swap-in point already
   isolated behind one function signature). Applied to: the QR scan route
   and the portal-activation route (unauthenticated, token-bearing public
   URLs — section 44), guest request/feedback submission (keyed by the
   guest's own session, not IP, so one guest's spam doesn't penalize a
   whole hotel behind one NAT'd IP), business signup (keyed by IP), and
   staff login (keyed by IP+email together, so neither dimension alone is
   a bypass).
9. **Business signup + settings UI** (`modules/business/service.ts`,
   `app/signup/`, `app/[businessSlug]/settings/`) — `signUpBusiness()`
   creates the Business+BusinessSettings row, a new owner `User`, and the
   `BUSINESS_OWNER` `BusinessMembership` as three sequential (not
   transactional) creates — deliberate, see that function's own comment
   for why this differs from the `$transaction` usage elsewhere in the
   codebase. On success the signup page immediately calls Auth.js's
   `signIn()` so the new owner lands straight in their dashboard.
   `updateBusinessCore`/`updateBusinessSettings` split the tenant-identity
   fields (name/timezone/currency, on `Business`) from
   branding/contact fields (on `BusinessSettings`) into two functions
   because they're two tables, even though the settings page submits both
   from one form.
10. Also fixed in passing: `app/login/page.tsx` previously hard-coded
    `redirectTo: "/"` and ignored the `next` param that
    `staff-context.ts`'s redirect already relied on — it now honors
    `?next=` (validated to be a same-site relative path only, so it can't
    become an open redirect) and round-trips it through a login error too.
11. **10 more unit tests** (`modules/analytics/metrics.test.ts`,
    `lib/rate-limit.test.ts`) — **96 total**, all passing.

Deliberately **not** in this milestone (flagged for later, not forgotten):
notifications (section 21 — nothing async/queued exists yet, and there's
still no real "event" infrastructure to hang it off), a "business switcher"
UI for a user with multiple memberships, staff invite/disable UI and
location/service management UI (repository functions exist from Milestone
2, nothing calls them from a route), `Task` decomposition (section 10),
per-service `dueAt` population, a real audit-log viewing screen (the
`business:view_audit_log` permission and `listAuditLogForBusiness` query
both already exist; no page renders them yet), and multi-instance-safe
(Redis-backed) rate limiting.

## Stack notes specific to this codebase

- **Next.js 16.3.5** — newer than most training data. Two things that
  differ from older Next.js docs:
  - `middleware.js` is deprecated and renamed to `proxy.js` (same
    behavior, new file/export name). Tenant-resolution middleware in the
    next milestone should be written as `src/proxy.ts`, not
    `middleware.ts`.
  - Route Handlers can type their `context` param with the generated
    `RouteContext<'/path/[id]'>` helper instead of hand-rolled types.
- **Prisma pinned to 6.19.3**, not `latest`. At the time of writing,
  `prisma@latest` resolves to an `8.0.0-rc` prerelease that trips an
  `npm`/`arborist` bug (`Cannot read properties of null (reading
  'edgesOut')`) on a clean install. Pinning to the last stable 6.x line
  installs cleanly. Re-evaluate the pin once Prisma 8 is GA.
- **Vitest pinned to 3.2.7**, not `latest` (5.x). Vitest 5 requires
  `@types/node` ^22/>=24; this project intentionally stays on
  `@types/node` ^20 to match Next's own typing baseline. Revisit together
  if/when the Node types version is bumped.

## Resolved: Prisma CLI's native engine binaries are blocked in this sandbox

`npx prisma generate`/`migrate` classically download a schema-engine and
query-engine binary from `binaries.prisma.sh` on first use. **In the
sandbox this project runs in, that host is blocked by the environment's
egress policy (403 on every request)**, and cannot be worked around by
`PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING` or `--no-engine` — both still
try to download a binary, just a different one, and both are blocked
identically. This is a sandbox/network limitation, not a schema problem,
but it used to mean nothing beyond `next build`'s static analysis could
be verified here.

**That limitation is now worked around, not just documented**: Prisma
6.7+ supports a fully engine-less "js" mode that never touches
`binaries.prisma.sh`, because everything it needs ships as ordinary npm
packages (WASM + JS) from `registry.npmjs.org`, which is not blocked:

- `prisma/schema.prisma`'s `generator client` block sets `engineType =
  "client"` — the generated Prisma Client is pure JS/WASM (bundled
  inside the `@prisma/client` npm package itself), so it never needs a
  native `libquery_engine.so.node`.
- `prisma.config.ts` sets `engine: "js"` with an `adapter` (an
  `@prisma/adapter-pg` instance over `pg`), which gives the CLI a driver
  adapter to run schema/migrate operations over instead of the native
  schema-engine binary. `@prisma/adapter-pg` is pinned to the exact same
  version as `prisma`/`@prisma/client` (`6.19.3`) — a newer adapter
  (7.x) against this schema-engine version fails schema/catalog
  introspection with `Column type 'name'/'char' could not be
  deserialized from the database`, a real version-skew bug, not a
  config mistake.
- `src/lib/prisma.ts` constructs the same `PrismaPg` adapter at runtime,
  so the app itself never needs the native engine either.

**One real gap remains in this mode**: the WASM schema-engine's
`describeSchema` (used by `prisma migrate dev`, `db push`, `migrate
deploy`'s history check, and `db pull`) fails against this project's
Postgres 16 with that same `'name'`/`'char'` deserialization error, even
against a completely empty database — it's hit while reading
`pg_catalog`, not any of this project's own tables, so it reproduces
regardless of schema content. **`prisma migrate diff --from-empty
--to-schema-datamodel prisma/schema.prisma --script` does not hit this**
(it never introspects a real database — it diffs the schema against a
hypothetical empty one), so that's how `prisma/migrations/*/migration.sql`
files are produced in this project; apply them with `psql -f
migration.sql` (or any plain Postgres client) and record the migration
in `_prisma_migrations` by hand (`id`, `checksum` = sha256 of the SQL
file, `migration_name`, `finished_at`, `applied_steps_count = 1`) rather
than `prisma migrate deploy`. Ordinary query execution (everything the
app itself does at runtime) is unaffected — this gap is specific to
schema-introspecting CLI commands, not to the generated client.

Verified end-to-end in this sandbox: `npm run db:generate` (no binary
download), the migration above applied to a local PostgreSQL 16 via
`psql`, `npm run db:seed` (creates the "Ocean Pearl Resort" tenant),
`npm run dev`, and then over HTTP — `/`, `/login`, `/signup`, the guest
portal (`/portal/activate` → `/portal`, rendering real seeded services),
and a staff login (`manager@oceanpearl.example`) reaching
`/ocean-pearl-resort/dashboard` authenticated as `MANAGER` with real
seeded data. `npm run typecheck`, `npm run lint`, and `npm run test`
(96/96) all still pass against the now-real (not stubbed) generated
client — two repositories (`audit`, `locations`) needed a
`Prisma.InputJsonValue` cast where they'd previously passed a bare
`Record<string, unknown>` to a JSON field, which only the real generated
types caught.

If a future environment (a real machine, CI) *does* have
`binaries.prisma.sh` reachable, none of this is required — reverting
`engineType`/`prisma.config.ts`/`src/lib/prisma.ts`'s adapter and using
a plain `datasources.db.url` works identically. This setup was chosen
because it's the only one that works in a sandbox with that host
blocked, not because it's a hard architectural requirement going
forward.

(Separately, `next build` also could not reach `fonts.googleapis.com` to
fetch the default `next/font/google` Geist font the `create-next-app`
template starts with. Rather than depend on that external call at build
time — fragile in any environment, not just this sandbox — `app/layout.tsx`
was switched to a plain system font stack. Revisit with `next/font/local`
and a self-hosted font file if/when real branding work happens.)

## Tenant isolation strategy

This is the platform's non-negotiable invariant (project instructions
section 33: "Business A must never be able to access Business B's data").
Two layers enforce it, deliberately redundant:

### 1. Database layer — composite foreign keys

Every tenant-owned table carries `businessId`. Instead of a bare
`id → id` foreign key between two tenant-owned rows, every such
relationship is a **composite** foreign key of the shape
`(businessId, otherId) → (businessId, id)`:

```prisma
model Department {
  id         String @id @default(cuid())
  businessId String
  @@unique([businessId, id])
}

model Service {
  businessId   String
  departmentId String?
  department   Department? @relation(fields: [businessId, departmentId], references: [businessId, id])
}
```

Postgres enforces this constraint. A `Service` cannot reference a
`Department` from a different business — that's a foreign-key violation
at the database layer, not a bug that application code could introduce.
This pattern is applied to every business-internal relation: Location's
self-referential hierarchy, Service→Department, QRCode→Location,
GuestStay→Guest/Location, GuestSession→GuestStay/QRCode,
Request→GuestStay/Location/Service/Department/BusinessMembership,
Feedback/Attachment→Request/GuestStay/Guest.

Two intentional exceptions:
- **`AuditLog`** and **`RequestStatusHistory`**'s actor references
  (`changedByUserId`/`changedByGuestId`) are scoped by `businessId` for
  querying but are not hard composite FKs to a specific row beyond that —
  an audit/history trail must remain readable even after the entity or
  actor it describes is deleted. `AuditLog.business` uses `onDelete:
  SetNull` (not `Cascade`, unlike every other tenant table) for the same
  reason: audit history should outlive a deleted tenant.
- **User** is deliberately not tenant-owned — one `User` can hold
  memberships in multiple businesses (spec section 13/16).

The cost is one extra unique index per table. That's cheap insurance for
the platform's core invariant.

### 2. Application layer — `authorize()`

Even with bulletproof foreign keys, application code could still load the
wrong row (e.g. via a raw client-supplied id) and act on it before ever
touching a second table. `src/modules/auth/authorize.ts` is the single
function everything else should call before mutating or returning
tenant-owned data. Its checks run in a fixed order:

1. **Tenant match** — if the actor is scoped to a business (`staff`,
   `guest`, or `system` actor) and the resource has a `businessId`, they
   must match, or the request is denied with `CROSS_TENANT` before any
   role/permission logic runs at all. Only a `platform` actor (super
   admin) may cross this boundary, and doing so is reported back via
   `viaPlatformOverride: true` — **the calling code is responsible for
   writing an `AuditLog` entry whenever that flag is true.**
2. **Role/kind permission grant** — a flat matrix
   (`ROLE_PERMISSIONS`/`GUEST_PERMISSIONS`/`PLATFORM_PERMISSIONS`/
   `SYSTEM_PERMISSIONS` in `src/modules/auth/permissions.ts`).
3. **Row-level rule** — for permissions where role alone isn't enough
   (e.g. "staff can complete a request, but only one assigned to them";
   "a guest can view a request, but only their own"), a small registered
   function in `ROW_LEVEL_RULES`.

`authorize()` never touches a database and never trusts a client-supplied
id directly — callers must have already derived the `Actor` from a
verified session/membership lookup or a validated QR+guest-session
resolution (see below), never from a raw request body field like
`businessId`.

Deliberate MVP policy choice, easy to find and revisit: `STAFF` does not
have `request:reject` / `request:reassign` / `request:cancel_any` in the
base matrix (project instructions section 14 says staff can
"reject/reassign **where permitted**" — the MVP default is "not
permitted"; only `MANAGER`/`BUSINESS_OWNER` can). If a business wants
looser staff permissions, that should become a per-business override
layered on top of this matrix, not an edit to the matrix itself.

## Request lifecycle (state machine)

`src/modules/requests/state-machine.ts` encodes the lifecycle from project
instructions section 9 as a single transition table:

```
NEW → ACCEPTED → IN_PROGRESS → COMPLETED → CLOSED
NEW → REJECTED
NEW/ACCEPTED → CANCELLED           (guest-initiated allowed)
IN_PROGRESS → CANCELLED            (staff/manager only)
```

`CLOSED` / `REJECTED` / `CANCELLED` are terminal — no transition out of
them is ever valid. `attemptTransition()` is pure (no I/O): it takes the
current status, the desired status, and which kind of actor is asking, and
returns either `{ ok: true, timestampField }` (telling the caller which
column to stamp, e.g. `acceptedAt`) or a typed denial reason. The calling
request service is expected to: run `authorize()` first, load the current
status, call `attemptTransition()`, and if `ok`, write the new status and
a `RequestStatusHistory` row in the same transaction.

Deliberate MVP policy choice: a guest can self-cancel while a request is
`NEW` or `ACCEPTED`, but not once it's `IN_PROGRESS` (work has already
started — cancellation past that point should go through staff). This is
a business-rule choice, not a technical constraint; it's isolated to one
line in the transition table if a business wants different behavior.

`Task` (the operational work-breakdown of a `Request`, section 10) is
intentionally not modeled yet — no table, no module. Build it when a
feature actually needs decomposition, per the "don't over-engineer"
instruction.

## QR and guest-session security

Three layers, matching project instructions sections 6–7:

1. **Tokens** (`src/lib/security/tokens.ts`) — 256-bit random tokens via
   `crypto.randomBytes`, never predictable paths like `/room/208`. Only
   the SHA-256 hash is ever persisted (`QRCode.tokenHash`,
   `GuestSession.tokenHash`); the raw token is shown/set exactly once at
   creation. SHA-256 (fast hash) is used deliberately instead of
   bcrypt/argon2 — those defend low-entropy human passwords against
   offline brute force by being slow; a 256-bit random token has no
   meaningful brute-force surface, so a fast, indexable hash is the
   correct tool (and the file's top comment explains this trade-off in
   full).
2. **QR scan resolution** (`src/modules/qr/qr-token.ts`,
   `resolveQrScan()`) — a pure function implementing the section-6
   checklist: invalid token → disabled QR → inactive business → missing
   guest session → revoked/expired session → tenant mismatch (defense in
   depth, even though the schema's composite FKs should make this
   structurally impossible) → stay not active/expired → tenant mismatch
   again on the stay. **A QR code identifies a location; it never grants
   access by itself** — scanning with no valid guest session is denied
   with `NO_GUEST_SESSION`, which is the direct expression of "a
   photographed/shared QR code does not give an outsider access."
3. **Guest sessions** (`src/modules/guest-sessions/guest-session.ts`) —
   sessions are tied to a `GuestStay` and expire at the *earlier* of a
   rolling max (`DEFAULT_MAX_SESSION_HOURS = 24`) or the stay's
   `checkOutAt`. The rolling cap matters: without it, a session created on
   day one of a five-night stay would stay valid — and dangerous if
   leaked — for the entire five nights. `isGuestSessionValid()` is the
   same validity check factored out for the "open the portal directly, no
   QR" path (section 5, Method 1), so both entry points share one
   definition of "still valid."

Rate limiting (checklist step 8) and actually issuing/persisting a session
row (steps 9–10) are route-handler/repository concerns for the next
milestone — kept out of these pure functions on purpose so the
security-critical branching logic itself is exhaustively unit-testable
without a database, an HTTP layer, or network mocking.

## Milestone 4 — Location/department/service/staff management UI, audit viewer, business switcher

Closes out almost everything Milestone 3 flagged as deferred. Same
verification method and same Prisma-generate limitation as every prior
milestone (see below) — still nothing has run against a real database.

1. **Department management** (`modules/departments/service.ts`,
   `app/[businessSlug]/departments/`) — create/rename, enforcing the
   schema's `@@unique([businessId, name])` with a friendly message
   (`getDepartmentByName` checked before insert) rather than surfacing a
   raw constraint-violation error. No status/archive concept — the schema
   doesn't have one, and departments are a small flat list, not something
   that needs soft-deletion yet.
2. **Location management** (`modules/locations/service.ts`,
   `app/[businessSlug]/locations/`) — the piece every prior milestone's
   "next steps" flagged as missing: until this, a business could only get
   real locations onto the platform via the seed script or Prisma Studio,
   which meant QR creation (Milestone 3) was only usable end-to-end with
   seeded data. Added `modules/locations/types.ts` with the `LocationType`/
   `LocationStatus` unions mirroring the Prisma enums — the repository's
   `type` field was typed as a bare `string` before this, which is exactly
   the kind of drift a shared enum-mirroring module exists to prevent.
   Supports parent-location selection for the hierarchy (Building → Floor
   → Room) directly in the create form.
3. **Service management** (`modules/services/service.ts`,
   `app/[businessSlug]/services/`) — create + activate/deactivate, with
   department linking (validated to belong to the same business before a
   service can reference it) and the default-priority/estimated-minutes
   fields the Service model already had. `listAllServicesForBusiness` is
   new (the existing `listActiveServicesForBusiness` is guest-portal-only
   by design and would hide inactive services from the management screen).
4. **Staff invite/disable** (`modules/staff/service.ts`,
   `app/[businessSlug]/staff/`) — "invite" creates the account directly
   with a generated 96-bit temporary password shown to the inviter exactly
   once (same reveal pattern as QR tokens and guest activation links),
   rather than emailing an invite link — there is still no async
   notification infrastructure to send that email through (see #6 below,
   carried forward again). Deliberately added a check `inviteStaffMember`
   didn't get for free from the permission matrix: `staff:invite` alone
   doesn't distinguish which role the invitee gets, so a MANAGER (who has
   `staff:invite` but not `staff:update_role`) could otherwise hand out
   `BUSINESS_OWNER` — blocked explicitly, not just by the UI hiding the
   option. A membership also can't disable itself (checked in the service
   layer, not just by hiding its own disable button).
5. **Audit log viewer** (`modules/audit/service.ts`'s new
   `getAuditLogForBusiness`, `app/[businessSlug]/audit/`) — the
   `business:view_audit_log` permission and `listAuditLogForBusiness`
   query had existed since Milestone 1/3 respectively with no page
   rendering them; this was the last "the plumbing exists, nothing calls
   it" gap from that list.
6. **Business switcher** (`modules/staff/repository.ts`'s new
   `listActiveMembershipsForUser`, `app/page.tsx`) — replaced the
   still-untouched `create-next-app` boilerplate at `/` (never edited
   since scaffolding — Auth.js's `signIn` already defaulted `redirectTo`
   there) with a real landing page: signed-out visitors see sign-in/signup
   links, signed-in users see every business they hold an ACTIVE
   membership at. `listActiveMembershipsForUser` is the one legitimate
   cross-tenant query in the codebase outside `authorize()`'s
   `PlatformActor` path — it spans businesses, but only ever returns a
   user's *own* memberships, so it doesn't weaken tenant isolation.
7. Nav links for all five new sections added to
   `app/[businessSlug]/layout.tsx`, alongside the existing ones.

Deliberately **still** deferred, now for the second or third time running:
notifications (section 21 — still no async event infrastructure, and now
genuinely the last major MVP gap), Redis-backed rate limiting for
multi-instance deployment, per-service `dueAt` population (manager
dashboard "overdue" still uses the flat 60-minute fallback), `Task`
decomposition (section 10), and a UI for granting a user membership at a
business they don't already belong to (only fresh-signup owner creation
and same-business staff invites exist; adding an *existing* user to a
*second* business has no UI or service function yet).

## Verification performed (current, after Milestone 4)

```bash
npm run typecheck   # tsc --noEmit — clean
npm run lint        # eslint — clean
npm run test        # vitest run — 96/96 passing across 8 files
npm run build       # next build — compiles & type-checks cleanly;
                     # fails only at page-data collection on the
                     # un-generated Prisma Client (see above)
```

Prisma schema validation/generation could not be run here (see the network
limitation above) and needs to happen as the first step of the next
session/milestone — see the `db:generate`/`db:migrate` commands above. This
remains true after Milestone 4: every module above is type-checked against
the un-generated Prisma stub, not exercised against a real database. No
schema changes were needed for Milestone 4 — every model this UI writes to
(Department, Location, Service, BusinessMembership, AuditLog) already
existed.

## Next milestone (proposed)

1. Run `db:generate` + first `db:migrate` in an unrestricted environment;
   fix any schema errors the compiler surfaces; run `npm run db:seed` and
   confirm the Ocean Pearl Resort tenant, then walk the **entire** flow
   through the UI (not the seed script) end to end: sign up a new business
   → configure settings → create a department → create a location → create
   a service linked to that department → generate a QR for the location →
   invite a staff member and sign in as them → check in a guest → open the
   activation link → scan the QR → submit a request → accept/start/
   complete it as staff → leave feedback → check the manager dashboard and
   audit log reflect it → check out the guest.
2. Once real Prisma types exist, tighten `PrismaTransactionClient` in
   `src/lib/prisma.ts` from `any` to the derived type noted in its TODO
   comment, and re-typecheck everything that uses it.
3. Notifications (async, queued — section 21). This is now the largest
   remaining V1-MVP gap: real events exist to notify about (request
   created/assigned/completed, negative feedback, staff invited), and
   `inviteStaffMember`'s temporary-password reveal is the last "shown once
   in the UI instead of emailed" workaround standing in for it.
4. A UI/flow for adding an *existing* user to a *second* business (today
   `signUpBusiness` only creates brand-new owners, and `inviteStaffMember`
   refuses if the email already has an account anywhere).
5. Redis-backed rate limiting before any multi-instance/multi-region
   deployment — `src/lib/rate-limit.ts`'s own comment documents exactly
   what needs to change and why the current in-process version is wrong
   for that scenario specifically (not for a single instance).
6. Per-service `dueAt` population at request-creation time, using
   `Service.estimatedMinutes`, so "overdue" in the manager dashboard
   reflects real per-service SLAs instead of the flat 60-minute fallback
   in `modules/analytics/metrics.ts`.
7. `Task` decomposition (section 10) — still correctly deferred; no
   feature has needed it yet.
