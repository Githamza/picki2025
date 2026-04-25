-- Fix coupons RLS to scope by vendor_admin_users.user_id (the actual auth.uid()),
-- not by vendor_admin_users.id which is a local PK unrelated to auth.users.
-- The previous policy mirrored business_hours_*_policy which is itself wrong but
-- masked there by additional permissive "Allow authenticated users" policies.

DROP POLICY IF EXISTS coupons_select_policy ON public.coupons;
DROP POLICY IF EXISTS coupons_insert_policy ON public.coupons;
DROP POLICY IF EXISTS coupons_update_policy ON public.coupons;
DROP POLICY IF EXISTS coupons_delete_policy ON public.coupons;

CREATE POLICY coupons_select_policy ON public.coupons
  FOR SELECT TO authenticated
  USING (vendor_id IN (
    SELECT vendor_id FROM public.vendor_admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY coupons_insert_policy ON public.coupons
  FOR INSERT TO authenticated
  WITH CHECK (vendor_id IN (
    SELECT vendor_id FROM public.vendor_admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY coupons_update_policy ON public.coupons
  FOR UPDATE TO authenticated
  USING (vendor_id IN (
    SELECT vendor_id FROM public.vendor_admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ))
  WITH CHECK (vendor_id IN (
    SELECT vendor_id FROM public.vendor_admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY coupons_delete_policy ON public.coupons
  FOR DELETE TO authenticated
  USING (vendor_id IN (
    SELECT vendor_id FROM public.vendor_admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ));
