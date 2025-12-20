-- Add currency to vendors so it can be configured per vendor.
-- Default is EUR for backward compatibility.

alter table public.vendors
add column if not exists currency text;

-- Backfill + normalize existing rows
update public.vendors
set currency = 'EUR'
where currency is null or btrim(currency) = '';

update public.vendors
set currency = upper(currency)
where currency is not null;

alter table public.vendors
alter column currency set default 'EUR';

alter table public.vendors
alter column currency set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendors_currency_iso4217_chk'
  ) then
    alter table public.vendors
      add constraint vendors_currency_iso4217_chk
      check (currency ~ '^[A-Z]{3}$');
  end if;
end $$;

