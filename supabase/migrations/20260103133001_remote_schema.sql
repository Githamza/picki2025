drop extension if exists "pg_net";

CREATE TRIGGER create_user_profile_trigger AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();


  create policy "Allow public reads from product-images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'product-images'::text));



  create policy "Allow public updates to product-images"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = 'product-images'::text));



  create policy "Allow public uploads to product-images"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'product-images'::text));



  create policy "Anyone can view listing images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'listing-images'::text));



  create policy "Give anon users access to JPG images in folder rq4fyk_0"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'productsophotos'::text) AND (lower((storage.foldername(name))[1]) = 'public'::text) AND (auth.role() = 'anon'::text)));



  create policy "Users can delete images from their own listings"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'listing-images'::text) AND (((storage.foldername(name))[1])::uuid IN ( SELECT listings.id
   FROM public.listings
  WHERE (listings.owner = auth.uid())))));



  create policy "Users can delete their own profile photos"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'profile-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can update images in their own listings"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'listing-images'::text) AND (((storage.foldername(name))[1])::uuid IN ( SELECT listings.id
   FROM public.listings
  WHERE (listings.owner = auth.uid())))));



  create policy "Users can update their own profile photos"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'profile-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can upload images to their own listings"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'listing-images'::text) AND (((storage.foldername(name))[1])::uuid IN ( SELECT listings.id
   FROM public.listings
  WHERE (listings.owner = auth.uid())))));



  create policy "Users can upload their own profile photos"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'profile-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can view their own profile photos"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'profile-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "upload oimages rq4fyk_0"
  on "storage"."objects"
  as permissive
  for insert
  to anon
with check ((bucket_id = 'productsophotos'::text));



