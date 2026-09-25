-- The app connects as a dedicated, non-superuser role (`oneweb_app`) rather
-- than `postgres`: on Supabase the `postgres` password can't be rotated from
-- SQL, and the app shouldn't hold the platform owner's credentials anyway.
--
-- Row-level security is on with no policies (see lock_down_public_api), which
-- denies every role except the table owner. This adds one permissive policy
-- per table for `oneweb_app` only; Supabase's `anon` / `authenticated` API
-- roles stay locked out. Tenant isolation is still enforced in the
-- application layer, as before.
--
-- Guarded so it also runs where the role doesn't exist (local Postgres,
-- where the app connects as the owner). Set the role's password out of band:
--   ALTER ROLE oneweb_app WITH PASSWORD '<random>';

DO $$
DECLARE t record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oneweb_app') THEN
    RETURN;
  END IF;

  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS oneweb_app_all ON public.%I', t.tablename);
    EXECUTE format('CREATE POLICY oneweb_app_all ON public.%I AS PERMISSIVE FOR ALL TO oneweb_app USING (true) WITH CHECK (true)', t.tablename);
  END LOOP;

  GRANT USAGE ON SCHEMA public TO oneweb_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oneweb_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO oneweb_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO oneweb_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO oneweb_app;
END $$;
