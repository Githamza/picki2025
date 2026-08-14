-- Let anonymous customers see inactive vendors again.
--
-- The storefront deliberately loads inactive/suspended vendors so it can show
-- the "boutique fermée" screen (see SupabaseService.getAllVendors, which
-- dropped its is_active filter for exactly that reason). The RLS baseline
-- policy "Public can view active vendors" (USING is_active = true) made a
-- suspended vendor invisible to anon instead: VendorGuard could not resolve
-- the slug, bounced to '/', and customers scanning the QR printed on
-- packaging landed on the admin login page (Allo Couscous incident,
-- 2026-08-11).
--
-- Exposing inactive rows is safe: the sensitive column (national_id) was
-- moved to the vendor-scoped vendor_private table in RLS Phase 2.
drop policy if exists "Public can view active vendors" on public.vendors;

create policy "Public can view vendors"
  on public.vendors for select
  using (true);
