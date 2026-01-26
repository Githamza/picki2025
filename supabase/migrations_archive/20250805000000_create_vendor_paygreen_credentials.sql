-- Migration: create table for storing vendor-specific PayGreen credentials
-- Extension for pgcrypto (for encryption helpers)
create extension if not exists pgcrypto;

-- Master key setting must be provided in the database (for example in post-deploy script):
--   alter system set app.paygreen_master = '<32+ char random secret>';

-- Helper functions (immutable / stable)
create or replace function enc_secret(p_plain text) returns text
  language sql immutable
as $$ select pgp_sym_encrypt(p_plain, current_setting('app.paygreen_master'))::text; $$;

create or replace function dec_secret(p_cipher text) returns text
  language sql stable
as $$ select pgp_sym_decrypt(p_cipher::bytea, current_setting('app.paygreen_master'))::text; $$;

-- Credentials table
create table if not exists vendor_paygreen_credentials (
  vendor_id uuid primary key references vendors(id) on delete cascade,
  shop_id text not null,
  public_key text not null,
  secret_key_enc text not null, -- encrypted secret key
  active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Trigger to update updated_at column
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_vendor_pg_creds_updated on vendor_paygreen_credentials;
create trigger trg_vendor_pg_creds_updated
  before update on vendor_paygreen_credentials
  for each row execute procedure set_updated_at();

-- Row Level Security
alter table vendor_paygreen_credentials enable row level security;

drop policy if exists service_read on vendor_paygreen_credentials;
create policy service_read on vendor_paygreen_credentials
  for select using (auth.role() = 'service_role');
