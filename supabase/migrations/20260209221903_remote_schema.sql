alter table "public"."vendors" add column "closed_description" text default 'N''hésitez pas à revenir plus tard.'::text;

alter table "public"."vendors" add column "closed_message" text default 'On est fermé actuellement'::text;

alter table "public"."vendors" add column "orders_suspended_message" text default 'les commandes en ligne sont actuellement suspendues'::text;


  create policy "vendor_admin_read_own_credentials"
  on "public"."vendor_paygreen_credentials"
  as permissive
  for select
  to authenticated
using ((vendor_id IN ( SELECT vendor_admin_users.vendor_id
   FROM public.vendor_admin_users
  WHERE (vendor_admin_users.user_id = auth.uid()))));



