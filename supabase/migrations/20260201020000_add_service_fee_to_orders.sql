-- Add service_fee column to orders table to store the service fee for each order
alter table "public"."orders" add column "service_fee" numeric not null default 0;

-- Add constraint to ensure service_fee is non-negative
alter table "public"."orders" add constraint "orders_service_fee_nonnegative" CHECK ((service_fee >= (0)::numeric)) not valid;

alter table "public"."orders" validate constraint "orders_service_fee_nonnegative";

-- Add comment for documentation
comment on column "public"."orders"."service_fee" is 'Service fee charged for this order, calculated at time of order creation';
