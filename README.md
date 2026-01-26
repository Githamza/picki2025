## my-angular-app

### Supabase local DB (fix: `42P01 relation "public.vendors" does not exist`)

If an Edge Function (ex: `create-vendor-account`) errors with:

- **code**: `42P01`
- **error**: `relation "public.vendors" does not exist`

your local database likely hasn’t applied migrations (or applied them in the wrong order).

Run:

```bash
cd my-angular-app
supabase db reset --yes --local
```

To confirm the table exists:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select to_regclass('public.vendors');"
```

### Edge Function env vars

`supabase/functions/create-vendor-account` uses:

- **local** (when `LOCALLY=true`): `LOCAL_SUPABASE_URL`, `LOCAL_SUPABASE_SERVICE_ROLE_KEY`
- **remote** (default): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

Use `supabase status` to find the local URLs/keys.

**Important (local functions):** when running `supabase functions serve`, the function runs in an Edge runtime container.
Inside that container, `http://127.0.0.1:54321` points to the container itself (not your host), so REST calls will fail with
errors like `TypeError: error sending request for url (http://127.0.0.1:54321/rest/v1/...)`.

Use the internal gateway URL instead:

- `LOCAL_SUPABASE_URL=http://kong:8000`
