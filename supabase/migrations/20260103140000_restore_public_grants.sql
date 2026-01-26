-- Restore privileges on public schema objects.
-- Some pulled "remote_schema" migrations include extensive REVOKE statements which can
-- break PostgREST access (e.g. "permission denied for table vendors" / SQLSTATE 42501).
--
-- RLS policies still apply; these GRANTs only restore table-level privileges.

grant usage on schema public to anon, authenticated, service_role;

-- Service role: full access for server-side operations (Edge Functions).
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- Client roles: allow access; rely on RLS policies for row-level enforcement.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;


