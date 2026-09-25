-- OneWeb only ever talks to Postgres server-side, through Prisma, as the
-- table owner. Hosted Postgres providers such as Supabase also expose every
-- table in the `public` schema through an auto-generated REST/GraphQL API
-- reachable with a public "anon" key. That API must never reach OneWeb's
-- tables: it bypasses every tenant-isolation and authorization check in the
-- application layer.
--
-- 1. Enable row-level security with NO policies on every table. For any role
--    other than the owner (which bypasses RLS), that means deny-all.
-- 2. Revoke all privileges from Supabase's API roles, now and for tables
--    created later. Guarded so this migration also runs on plain Postgres,
--    where those roles don't exist.

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
