create type "public"."payment_provider_choice" as enum ('PAYGREEN', 'STRIPE');

alter table "public"."vendor_paygreen_credentials" add column "sandbox_public_key" text;

alter table "public"."vendor_paygreen_credentials" add column "sandbox_secret_key" text;

alter table "public"."vendor_paygreen_credentials" add column "sandbox_shop_id" text;

alter table "public"."vendors" add column "banner_url" text;

alter table "public"."vendors" add column "orders_suspended_at" timestamp with time zone;

alter table "public"."vendors" add column "paymentprovider" public.payment_provider_choice not null default 'PAYGREEN'::public.payment_provider_choice;

alter table "public"."vendors" add column "service_fee_fixed" numeric not null default 0;

alter table "public"."vendors" add column "service_fee_rate_percent" numeric not null default 0;

alter table "public"."vendors" add constraint "vendors_service_fee_fixed_nonnegative" CHECK ((service_fee_fixed >= (0)::numeric)) not valid;

alter table "public"."vendors" validate constraint "vendors_service_fee_fixed_nonnegative";

alter table "public"."vendors" add constraint "vendors_service_fee_rate_percent_nonnegative" CHECK ((service_fee_rate_percent >= (0)::numeric)) not valid;

alter table "public"."vendors" validate constraint "vendors_service_fee_rate_percent_nonnegative";

grant references on table "public"."banners" to "anon";

grant trigger on table "public"."banners" to "anon";

grant truncate on table "public"."banners" to "anon";

grant references on table "public"."banners" to "authenticated";

grant trigger on table "public"."banners" to "authenticated";

grant truncate on table "public"."banners" to "authenticated";

grant references on table "public"."business_hours" to "anon";

grant trigger on table "public"."business_hours" to "anon";

grant truncate on table "public"."business_hours" to "anon";

grant references on table "public"."business_hours" to "authenticated";

grant trigger on table "public"."business_hours" to "authenticated";

grant truncate on table "public"."business_hours" to "authenticated";

grant references on table "public"."categories" to "anon";

grant trigger on table "public"."categories" to "anon";

grant truncate on table "public"."categories" to "anon";

grant references on table "public"."categories" to "authenticated";

grant trigger on table "public"."categories" to "authenticated";

grant truncate on table "public"."categories" to "authenticated";

grant references on table "public"."customisation_options" to "anon";

grant trigger on table "public"."customisation_options" to "anon";

grant truncate on table "public"."customisation_options" to "anon";

grant references on table "public"."customisation_options" to "authenticated";

grant trigger on table "public"."customisation_options" to "authenticated";

grant truncate on table "public"."customisation_options" to "authenticated";

grant references on table "public"."customisations" to "anon";

grant trigger on table "public"."customisations" to "anon";

grant truncate on table "public"."customisations" to "anon";

grant references on table "public"."customisations" to "authenticated";

grant trigger on table "public"."customisations" to "authenticated";

grant truncate on table "public"."customisations" to "authenticated";

grant references on table "public"."listings" to "anon";

grant trigger on table "public"."listings" to "anon";

grant truncate on table "public"."listings" to "anon";

grant references on table "public"."listings" to "authenticated";

grant trigger on table "public"."listings" to "authenticated";

grant truncate on table "public"."listings" to "authenticated";

grant references on table "public"."order_deliveries" to "anon";

grant trigger on table "public"."order_deliveries" to "anon";

grant truncate on table "public"."order_deliveries" to "anon";

grant references on table "public"."order_deliveries" to "authenticated";

grant trigger on table "public"."order_deliveries" to "authenticated";

grant truncate on table "public"."order_deliveries" to "authenticated";

grant references on table "public"."order_item_complements" to "anon";

grant trigger on table "public"."order_item_complements" to "anon";

grant truncate on table "public"."order_item_complements" to "anon";

grant references on table "public"."order_item_complements" to "authenticated";

grant trigger on table "public"."order_item_complements" to "authenticated";

grant truncate on table "public"."order_item_complements" to "authenticated";

grant references on table "public"."order_items" to "anon";

grant trigger on table "public"."order_items" to "anon";

grant truncate on table "public"."order_items" to "anon";

grant references on table "public"."order_items" to "authenticated";

grant trigger on table "public"."order_items" to "authenticated";

grant truncate on table "public"."order_items" to "authenticated";

grant references on table "public"."orders" to "anon";

grant trigger on table "public"."orders" to "anon";

grant truncate on table "public"."orders" to "anon";

grant references on table "public"."orders" to "authenticated";

grant trigger on table "public"."orders" to "authenticated";

grant truncate on table "public"."orders" to "authenticated";

grant references on table "public"."payment_splits" to "anon";

grant trigger on table "public"."payment_splits" to "anon";

grant truncate on table "public"."payment_splits" to "anon";

grant references on table "public"."payment_splits" to "authenticated";

grant trigger on table "public"."payment_splits" to "authenticated";

grant truncate on table "public"."payment_splits" to "authenticated";

grant references on table "public"."payments" to "anon";

grant trigger on table "public"."payments" to "anon";

grant truncate on table "public"."payments" to "anon";

grant references on table "public"."payments" to "authenticated";

grant trigger on table "public"."payments" to "authenticated";

grant truncate on table "public"."payments" to "authenticated";

grant references on table "public"."product_complements" to "anon";

grant trigger on table "public"."product_complements" to "anon";

grant truncate on table "public"."product_complements" to "anon";

grant references on table "public"."product_complements" to "authenticated";

grant trigger on table "public"."product_complements" to "authenticated";

grant truncate on table "public"."product_complements" to "authenticated";

grant references on table "public"."product_customisations" to "anon";

grant trigger on table "public"."product_customisations" to "anon";

grant truncate on table "public"."product_customisations" to "anon";

grant references on table "public"."product_customisations" to "authenticated";

grant trigger on table "public"."product_customisations" to "authenticated";

grant truncate on table "public"."product_customisations" to "authenticated";

grant references on table "public"."product_options" to "anon";

grant trigger on table "public"."product_options" to "anon";

grant truncate on table "public"."product_options" to "anon";

grant references on table "public"."product_options" to "authenticated";

grant trigger on table "public"."product_options" to "authenticated";

grant truncate on table "public"."product_options" to "authenticated";

grant references on table "public"."product_step_options" to "anon";

grant trigger on table "public"."product_step_options" to "anon";

grant truncate on table "public"."product_step_options" to "anon";

grant references on table "public"."product_step_options" to "authenticated";

grant trigger on table "public"."product_step_options" to "authenticated";

grant truncate on table "public"."product_step_options" to "authenticated";

grant references on table "public"."product_steps" to "anon";

grant trigger on table "public"."product_steps" to "anon";

grant truncate on table "public"."product_steps" to "anon";

grant references on table "public"."product_steps" to "authenticated";

grant trigger on table "public"."product_steps" to "authenticated";

grant truncate on table "public"."product_steps" to "authenticated";

grant references on table "public"."products" to "anon";

grant trigger on table "public"."products" to "anon";

grant truncate on table "public"."products" to "anon";

grant references on table "public"."products" to "authenticated";

grant trigger on table "public"."products" to "authenticated";

grant truncate on table "public"."products" to "authenticated";

grant references on table "public"."user_profiles" to "anon";

grant trigger on table "public"."user_profiles" to "anon";

grant truncate on table "public"."user_profiles" to "anon";

grant references on table "public"."user_profiles" to "authenticated";

grant trigger on table "public"."user_profiles" to "authenticated";

grant truncate on table "public"."user_profiles" to "authenticated";

grant references on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant references on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant references on table "public"."vendor_admin_users" to "anon";

grant trigger on table "public"."vendor_admin_users" to "anon";

grant truncate on table "public"."vendor_admin_users" to "anon";

grant references on table "public"."vendor_admin_users" to "authenticated";

grant trigger on table "public"."vendor_admin_users" to "authenticated";

grant truncate on table "public"."vendor_admin_users" to "authenticated";

grant references on table "public"."vendor_metadata" to "anon";

grant trigger on table "public"."vendor_metadata" to "anon";

grant truncate on table "public"."vendor_metadata" to "anon";

grant references on table "public"."vendor_metadata" to "authenticated";

grant trigger on table "public"."vendor_metadata" to "authenticated";

grant truncate on table "public"."vendor_metadata" to "authenticated";

grant references on table "public"."vendor_paygreen_credentials" to "anon";

grant trigger on table "public"."vendor_paygreen_credentials" to "anon";

grant truncate on table "public"."vendor_paygreen_credentials" to "anon";

grant references on table "public"."vendor_paygreen_credentials" to "authenticated";

grant trigger on table "public"."vendor_paygreen_credentials" to "authenticated";

grant truncate on table "public"."vendor_paygreen_credentials" to "authenticated";

grant references on table "public"."vendor_stuart_settings" to "anon";

grant trigger on table "public"."vendor_stuart_settings" to "anon";

grant truncate on table "public"."vendor_stuart_settings" to "anon";

grant references on table "public"."vendor_stuart_settings" to "authenticated";

grant trigger on table "public"."vendor_stuart_settings" to "authenticated";

grant truncate on table "public"."vendor_stuart_settings" to "authenticated";

grant references on table "public"."vendors" to "anon";

grant trigger on table "public"."vendors" to "anon";

grant truncate on table "public"."vendors" to "anon";

grant references on table "public"."vendors" to "authenticated";

grant trigger on table "public"."vendors" to "authenticated";

grant truncate on table "public"."vendors" to "authenticated";


  create policy "Authenticated users can delete vendor assets"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'vendor-assets'::text));



  create policy "Authenticated users can update vendor assets"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'vendor-assets'::text));



  create policy "Authenticated users can upload vendor assets"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'vendor-assets'::text));



  create policy "Public read access for vendor assets"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'vendor-assets'::text));



