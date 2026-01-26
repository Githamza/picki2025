-- Migration: switch to plain secret_key column, drop encryption helpers

alter table vendor_paygreen_credentials
  add column if not exists secret_key text;

-- Copy data from enc column if it exists and plain column is null
update vendor_paygreen_credentials
set secret_key = coalesce(secret_key, dec_secret(secret_key_enc))
where secret_key is null
  and exists(select 1 from pg_proc where proname = 'dec_secret');

-- Drop encrypted column and helper functions if desired
alter table vendor_paygreen_credentials
  drop column if exists secret_key_enc;

drop function if exists enc_secret(text);
drop function if exists dec_secret(text);

drop policy if exists service_read on vendor_paygreen_credentials;
-- RLS: only service_role can read
create policy service_read on vendor_paygreen_credentials
  for select using (auth.role() = 'service_role');