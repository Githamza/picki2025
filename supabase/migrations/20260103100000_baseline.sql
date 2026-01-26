

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."order_status" AS ENUM (
    'todo',
    'ongoing',
    'done',
    'picked',
    'cancelled',
    'initiated',
    'paid',
    'refused'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."order_timing" AS ENUM (
    'asap',
    'later'
);


ALTER TYPE "public"."order_timing" OWNER TO "postgres";


CREATE TYPE "public"."order_type" AS ENUM (
    'eat-in',
    'take-away',
    'delivery'
);


ALTER TYPE "public"."order_type" OWNER TO "postgres";


CREATE TYPE "public"."payment_provider" AS ENUM (
    'paygreen',
    'stripe'
);


ALTER TYPE "public"."payment_provider" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded',
    'paid'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'customer',
    'vendor',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  -- Insert into public.user_profiles with explicit schema qualification
  INSERT INTO public.user_profiles (id, first_name, last_name, phone, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.phone,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_user_profile"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_user_profile"() IS 'Automatically creates a user profile when an auth user is created. Fixed with proper search_path.';



CREATE OR REPLACE FUNCTION "public"."is_vendor_order"("order_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.vendors v ON v.id = oi.vendor_id
    WHERE oi.order_id = $1
    AND v.user_id = auth.uid()
  );
END;
$_$;


ALTER FUNCTION "public"."is_vendor_order"("order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."order_item_belongs_to_user"("item_order_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = item_order_id 
    AND (user_id = auth.uid() OR auth.uid() IS NULL)
  );
END;
$$;


ALTER FUNCTION "public"."order_item_belongs_to_user"("item_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end; $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_listings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_listings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_vendor_for_order_item"("item_vendor_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.vendors 
    WHERE id = item_vendor_id 
    AND user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."user_is_vendor_for_order_item"("item_vendor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_owns_order"("order_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = order_id 
    AND (user_id = auth.uid() OR auth.uid() IS NULL)
  );
END;
$$;


ALTER FUNCTION "public"."user_owns_order"("order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vendor_has_items_in_order"("order_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.order_items oi
    JOIN public.vendors v ON v.id = oi.vendor_id
    WHERE oi.order_id = $1
    AND v.user_id = auth.uid()
  );
END;
$_$;


ALTER FUNCTION "public"."vendor_has_items_in_order"("order_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."banners" (
    "id" integer NOT NULL,
    "title" character varying(255),
    "image_url" "text" NOT NULL,
    "link_url" "text",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "vendor_id" "uuid"
);


ALTER TABLE "public"."banners" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."banners_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."banners_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."banners_id_seq" OWNED BY "public"."banners"."id";



CREATE TABLE IF NOT EXISTS "public"."business_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "open_time" time without time zone,
    "close_time" time without time zone,
    "is_closed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "business_hours_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."business_hours" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_hours" IS 'Business hours for each vendor, with RLS policies ensuring vendors can only access their own data';



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "icon" character varying(50),
    "image_url" "text",
    "description" "text",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "vendorId" "uuid"
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."categories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."categories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."categories_id_seq" OWNED BY "public"."categories"."id";



CREATE TABLE IF NOT EXISTS "public"."customisation_options" (
    "id" bigint NOT NULL,
    "customisation_id" bigint NOT NULL,
    "product_id" bigint,
    "name" "text" NOT NULL,
    "price_adjustment" numeric DEFAULT 0,
    "display_order" integer DEFAULT 0,
    "is_available" boolean DEFAULT true,
    "option_type" "text" DEFAULT 'component'::"text",
    "description" "text",
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customisation_options_option_type_check" CHECK (("option_type" = ANY (ARRAY['component'::"text", 'product'::"text"])))
);


ALTER TABLE "public"."customisation_options" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."customisation_options_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."customisation_options_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."customisation_options_id_seq" OWNED BY "public"."customisation_options"."id";



CREATE TABLE IF NOT EXISTS "public"."customisations" (
    "id" bigint NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "selection_type" "text" NOT NULL,
    "is_required" boolean DEFAULT false,
    "min_selections" integer DEFAULT 0,
    "max_selections" integer DEFAULT 1,
    "display_order" integer DEFAULT 0,
    "is_available" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customisations_selection_type_check" CHECK (("selection_type" = ANY (ARRAY['single-select'::"text", 'multi-select'::"text"])))
);


ALTER TABLE "public"."customisations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."customisations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."customisations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."customisations_id_seq" OWNED BY "public"."customisations"."id";



CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "owner" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "address" "text",
    "price" numeric(12,2) NOT NULL,
    "price_per_m2" numeric(10,2),
    "superficie" numeric(10,2),
    "titre_bleu" boolean DEFAULT false,
    "electricite" boolean DEFAULT false,
    "eau" boolean DEFAULT false,
    "permis_construire" boolean DEFAULT false,
    "category" "text" DEFAULT 'urbaine'::"text" NOT NULL,
    "road" "text" DEFAULT 'piste'::"text" NOT NULL,
    "description" "text",
    "polygon" "jsonb",
    "marker" "jsonb",
    "images" "text"[] DEFAULT '{}'::"text"[],
    "published" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "listings_category_check" CHECK (("category" = ANY (ARRAY['agricole'::"text", 'urbaine'::"text"]))),
    CONSTRAINT "listings_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "listings_price_per_m2_check" CHECK (("price_per_m2" >= (0)::numeric)),
    CONSTRAINT "listings_road_check" CHECK (("road" = ANY (ARRAY['piste'::"text", 'goudronnee'::"text"]))),
    CONSTRAINT "listings_superficie_check" CHECK (("superficie" > (0)::numeric))
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "quote_amount_minor" integer NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "eta_minutes" integer,
    "pickup_line1" "text" NOT NULL,
    "pickup_postal_code" "text" NOT NULL,
    "pickup_city" "text" NOT NULL,
    "pickup_country_code" "text" NOT NULL,
    "pickup_lat" numeric,
    "pickup_lng" numeric,
    "dropoff_line1" "text" NOT NULL,
    "dropoff_postal_code" "text" NOT NULL,
    "dropoff_city" "text" NOT NULL,
    "dropoff_country_code" "text" NOT NULL,
    "dropoff_lat" numeric,
    "dropoff_lng" numeric,
    "delivery_id" "text",
    "tracking_url" "text",
    "status" "text",
    "raw" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_id" "text",
    "occurred_at" timestamp with time zone,
    "event_id" "text",
    "current_task" "text",
    "last_known_location" "jsonb",
    CONSTRAINT "order_deliveries_current_task_check" CHECK ((("current_task" = ANY (ARRAY['pickup'::"text", 'dropoff'::"text"])) OR ("current_task" IS NULL)))
);


ALTER TABLE "public"."order_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_item_complements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" integer NOT NULL,
    "complement_product_id" integer NOT NULL,
    "complement_name" "text" NOT NULL,
    "quantity" integer DEFAULT 1,
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_item_complements" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_item_complements" IS 'Tracks which complements were selected for each order item';



COMMENT ON COLUMN "public"."order_item_complements"."complement_name" IS 'Name of complement at time of order (for historical accuracy)';



COMMENT ON COLUMN "public"."order_item_complements"."unit_price" IS 'Price per complement unit at time of order';



COMMENT ON COLUMN "public"."order_item_complements"."total_price" IS 'Total price for this complement selection (unit_price * quantity)';



CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" integer NOT NULL,
    "order_id" "uuid",
    "product_id" integer,
    "vendor_id" "uuid",
    "product_name" character varying(255) NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "options" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "comment" "text"
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."order_items_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."order_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."order_items_id_seq" OWNED BY "public"."order_items"."id";



CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_number" character varying(50) NOT NULL,
    "user_id" "uuid",
    "customer_first_name" character varying(100) NOT NULL,
    "customer_last_name" character varying(100) NOT NULL,
    "customer_email" character varying(255) NOT NULL,
    "customer_phone" character varying(20),
    "total_amount" numeric(10,2) NOT NULL,
    "status" "public"."order_status" DEFAULT 'todo'::"public"."order_status",
    "order_type" "public"."order_type" NOT NULL,
    "timing" "public"."order_timing" DEFAULT 'asap'::"public"."order_timing",
    "scheduled_time" timestamp with time zone,
    "table_number" character varying(20),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "confirmation_email_sent" boolean DEFAULT false,
    "ready_email_sent" boolean DEFAULT false,
    "vendor_id" "uuid",
    "refuse_reason" "text",
    "pay_at_checkout" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."vendor_id" IS 'Reference to the vendor this order belongs to';



CREATE TABLE IF NOT EXISTS "public"."payment_splits" (
    "id" integer NOT NULL,
    "payment_id" "uuid",
    "vendor_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "transfer_id" character varying(255),
    "transfer_status" character varying(50),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."payment_splits" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."payment_splits_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."payment_splits_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."payment_splits_id_seq" OWNED BY "public"."payment_splits"."id";



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid",
    "provider" "public"."payment_provider" NOT NULL,
    "provider_payment_id" character varying(255) NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'EUR'::character varying,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status",
    "payment_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_complements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" integer NOT NULL,
    "complement_product_id" integer NOT NULL,
    "is_required" boolean DEFAULT false,
    "selection_type" "text" DEFAULT 'single'::"text",
    "max_selections" integer DEFAULT 1,
    "display_order" integer DEFAULT 0,
    "custom_price" numeric(10,2),
    "is_free" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "product_complements_check" CHECK (("product_id" <> "complement_product_id")),
    CONSTRAINT "product_complements_selection_type_check" CHECK (("selection_type" = ANY (ARRAY['single'::"text", 'multiple'::"text"])))
);


ALTER TABLE "public"."product_complements" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_complements" IS 'Links products to their available complement products (e.g., sauce with burger)';



COMMENT ON COLUMN "public"."product_complements"."is_required" IS 'Whether selecting a complement is mandatory for this product';



COMMENT ON COLUMN "public"."product_complements"."selection_type" IS 'Whether user can select single or multiple complements';



COMMENT ON COLUMN "public"."product_complements"."max_selections" IS 'Maximum number of complements that can be selected';



COMMENT ON COLUMN "public"."product_complements"."custom_price" IS 'Override price for complement when linked to this product (NULL uses original price)';



COMMENT ON COLUMN "public"."product_complements"."is_free" IS 'Make complement free when linked to this product';



CREATE TABLE IF NOT EXISTS "public"."product_customisations" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "customisation_id" bigint NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_customisations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."product_customisations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."product_customisations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_customisations_id_seq" OWNED BY "public"."product_customisations"."id";



CREATE TABLE IF NOT EXISTS "public"."product_options" (
    "id" integer NOT NULL,
    "product_id" integer,
    "name" character varying(100) NOT NULL,
    "price_adjustment" numeric(10,2) DEFAULT 0,
    "is_available" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."product_options" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."product_options_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."product_options_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_options_id_seq" OWNED BY "public"."product_options"."id";



CREATE TABLE IF NOT EXISTS "public"."product_step_options" (
    "id" integer NOT NULL,
    "product_id" integer,
    "name" character varying(255) DEFAULT 'Option'::character varying NOT NULL,
    "price_adjustment" numeric(10,2) DEFAULT 0,
    "display_order" integer DEFAULT 0,
    "is_available" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "image_url" "text",
    "option_type" character varying(20) DEFAULT 'component'::character varying,
    "description" "text",
    "step_ids" integer[] NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    CONSTRAINT "check_step_ids_not_empty" CHECK (("array_length"("step_ids", 1) > 0)),
    CONSTRAINT "product_step_options_option_type_check" CHECK ((("option_type")::"text" = ANY (ARRAY[('component'::character varying)::"text", ('product'::character varying)::"text"])))
);


ALTER TABLE "public"."product_step_options" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."product_step_options_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."product_step_options_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_step_options_id_seq" OWNED BY "public"."product_step_options"."id";



CREATE TABLE IF NOT EXISTS "public"."product_steps" (
    "id" integer NOT NULL,
    "product_id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "step_type" character varying(255),
    "description" "text",
    "is_required" boolean DEFAULT true,
    "min_selections" integer DEFAULT 0,
    "max_selections" integer DEFAULT 1,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_steps" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."product_steps_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."product_steps_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_steps_id_seq" OWNED BY "public"."product_steps"."id";



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" integer NOT NULL,
    "vendor_id" "uuid",
    "category_id" integer,
    "name" character varying(255) NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "image_url" "text",
    "short_description" "text",
    "long_description" "text",
    "is_available" boolean DEFAULT true,
    "stock_quantity" integer,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "is_multi_step" boolean DEFAULT false,
    "no_catalogable" boolean DEFAULT false,
    "display_order" integer DEFAULT 0 NOT NULL,
    "has_customisations" boolean DEFAULT false
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."no_catalogable" IS 'Indicates whether the product is excluded from the catalog (true = not in catalog, false = in catalog)';



CREATE SEQUENCE IF NOT EXISTS "public"."products_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."products_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."products_id_seq" OWNED BY "public"."products"."id";



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "phone" "text",
    "date_of_birth" "date",
    "bio" "text",
    "profile_photo_url" "text",
    "city" "text",
    "country" "text" DEFAULT 'Morocco'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "first_name" character varying(100) NOT NULL,
    "last_name" character varying(100) NOT NULL,
    "phone" character varying(20),
    "role" "public"."user_role" DEFAULT 'customer'::"public"."user_role",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendor_admin_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "first_name" character varying(100) NOT NULL,
    "last_name" character varying(100) NOT NULL,
    "role" character varying(50) DEFAULT 'admin'::character varying NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "user_id" "uuid"
);


ALTER TABLE "public"."vendor_admin_users" OWNER TO "postgres";


COMMENT ON TABLE "public"."vendor_admin_users" IS 'Stores admin user credentials for each vendor';



COMMENT ON COLUMN "public"."vendor_admin_users"."vendor_id" IS 'Reference to the vendor this admin user belongs to';



COMMENT ON COLUMN "public"."vendor_admin_users"."email" IS 'Admin user email address (unique per vendor)';



COMMENT ON COLUMN "public"."vendor_admin_users"."role" IS 'User role: admin, manager, or staff';



COMMENT ON COLUMN "public"."vendor_admin_users"."is_active" IS 'Whether the admin user account is active';



COMMENT ON COLUMN "public"."vendor_admin_users"."last_login_at" IS 'Timestamp of last successful login';



CREATE TABLE IF NOT EXISTS "public"."vendor_metadata" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "phone" "text",
    "email" character varying(255),
    "website" character varying(500),
    "street" character varying(255),
    "city" character varying(100),
    "postal_code" character varying(20),
    "country" character varying(100) DEFAULT 'France'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vendor_metadata" OWNER TO "postgres";


COMMENT ON TABLE "public"."vendor_metadata" IS 'Vendor metadata table with RLS disabled for application functionality';



CREATE TABLE IF NOT EXISTS "public"."vendor_paygreen_credentials" (
    "vendor_id" "uuid" NOT NULL,
    "shop_id" "text" NOT NULL,
    "public_key" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "secret_key" "text"
);


ALTER TABLE "public"."vendor_paygreen_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendor_stuart_settings" (
    "vendor_id" "uuid" NOT NULL,
    "webhook_id" "text",
    "webhook_url" "text",
    "topics" "text"[] DEFAULT '{}'::"text"[],
    "enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vendor_stuart_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "business_name" character varying(255) NOT NULL,
    "business_type" character varying(50) DEFAULT 'individual'::character varying,
    "stripe_account_id" character varying(255),
    "stripe_onboarding_completed" boolean DEFAULT false,
    "paygreen_merchant_id" character varying(255),
    "country" character varying(2) DEFAULT 'FR'::character varying,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "logo_url" "text",
    "auth_user_id" "uuid",
    "customDomain" "text",
    "enabled_order_types" "public"."order_type"[] DEFAULT ARRAY['eat-in'::"public"."order_type", 'take-away'::"public"."order_type", 'delivery'::"public"."order_type"] NOT NULL,
    "delivery_dropoff_input_mode" "text" DEFAULT 'address'::"text" NOT NULL,
    "online_payments_enabled" boolean DEFAULT true NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "delivery_system" "text" DEFAULT 'picki'::"text" NOT NULL,
    "own_delivery_price" numeric DEFAULT 0 NOT NULL,
    CONSTRAINT "vendors_currency_iso4217_chk" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "vendors_delivery_dropoff_input_mode_check" CHECK (("delivery_dropoff_input_mode" = ANY (ARRAY['address'::"text", 'geolocation'::"text"]))),
    CONSTRAINT "vendors_delivery_system_check" CHECK (("delivery_system" = ANY (ARRAY['picki'::"text", 'own'::"text"]))),
    CONSTRAINT "vendors_enabled_order_types_non_empty" CHECK ((COALESCE("array_length"("enabled_order_types", 1), 0) > 0))
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


COMMENT ON COLUMN "public"."vendors"."logo_url" IS 'URL to the vendor logo image';



ALTER TABLE ONLY "public"."banners" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."banners_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."categories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."customisation_options" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."customisation_options_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."customisations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."customisations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."order_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."order_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."payment_splits" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."payment_splits_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product_customisations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_customisations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product_options" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_options_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product_step_options" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_step_options_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product_steps" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_steps_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."products" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."products_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."banners"
    ADD CONSTRAINT "banners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_hours"
    ADD CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customisation_options"
    ADD CONSTRAINT "customisation_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customisations"
    ADD CONSTRAINT "customisations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_deliveries"
    ADD CONSTRAINT "order_deliveries_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."order_deliveries"
    ADD CONSTRAINT "order_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_item_complements"
    ADD CONSTRAINT "order_item_complements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_splits"
    ADD CONSTRAINT "payment_splits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_provider_payment_id_key" UNIQUE ("provider_payment_id");



ALTER TABLE ONLY "public"."product_complements"
    ADD CONSTRAINT "product_complements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_complements"
    ADD CONSTRAINT "product_complements_product_id_complement_product_id_key" UNIQUE ("product_id", "complement_product_id");



ALTER TABLE ONLY "public"."product_customisations"
    ADD CONSTRAINT "product_customisations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_customisations"
    ADD CONSTRAINT "product_customisations_product_id_customisation_id_key" UNIQUE ("product_id", "customisation_id");



ALTER TABLE ONLY "public"."product_options"
    ADD CONSTRAINT "product_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_step_options"
    ADD CONSTRAINT "product_step_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_steps"
    ADD CONSTRAINT "product_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_admin_users"
    ADD CONSTRAINT "unique_vendor_email" UNIQUE ("vendor_id", "email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_admin_users"
    ADD CONSTRAINT "vendor_admin_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_admin_users"
    ADD CONSTRAINT "vendor_admin_users_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."vendor_metadata"
    ADD CONSTRAINT "vendor_metadata_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_paygreen_credentials"
    ADD CONSTRAINT "vendor_paygreen_credentials_pkey" PRIMARY KEY ("vendor_id");



ALTER TABLE ONLY "public"."vendor_stuart_settings"
    ADD CONSTRAINT "vendor_stuart_settings_pkey" PRIMARY KEY ("vendor_id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_stripe_account_id_key" UNIQUE ("stripe_account_id");



CREATE INDEX "idx_business_hours_day_of_week" ON "public"."business_hours" USING "btree" ("day_of_week");



CREATE UNIQUE INDEX "idx_business_hours_vendor_day" ON "public"."business_hours" USING "btree" ("vendor_id", "day_of_week");



CREATE INDEX "idx_business_hours_vendor_id" ON "public"."business_hours" USING "btree" ("vendor_id");



CREATE INDEX "idx_customisation_options_customisation_id" ON "public"."customisation_options" USING "btree" ("customisation_id");



CREATE INDEX "idx_customisation_options_product_id" ON "public"."customisation_options" USING "btree" ("product_id");



CREATE INDEX "idx_customisations_vendor_id" ON "public"."customisations" USING "btree" ("vendor_id");



CREATE INDEX "idx_listings_category" ON "public"."listings" USING "btree" ("category");



CREATE INDEX "idx_listings_created_at" ON "public"."listings" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_listings_owner" ON "public"."listings" USING "btree" ("owner");



CREATE INDEX "idx_listings_price" ON "public"."listings" USING "btree" ("price");



CREATE INDEX "idx_listings_published" ON "public"."listings" USING "btree" ("published");



CREATE INDEX "idx_listings_road" ON "public"."listings" USING "btree" ("road");



CREATE INDEX "idx_listings_superficie" ON "public"."listings" USING "btree" ("superficie");



CREATE INDEX "idx_order_deliveries_current_task" ON "public"."order_deliveries" USING "btree" ("current_task");



CREATE INDEX "idx_order_deliveries_event_id" ON "public"."order_deliveries" USING "btree" ("event_id");



CREATE INDEX "idx_order_deliveries_job_id" ON "public"."order_deliveries" USING "btree" ("job_id");



CREATE INDEX "idx_order_deliveries_occurred_at" ON "public"."order_deliveries" USING "btree" ("occurred_at");



CREATE INDEX "idx_order_deliveries_order_id" ON "public"."order_deliveries" USING "btree" ("order_id");



CREATE INDEX "idx_order_item_complements_order_item_id" ON "public"."order_item_complements" USING "btree" ("order_item_id");



CREATE INDEX "idx_order_items_comment" ON "public"."order_items" USING "btree" ("comment") WHERE ("comment" IS NOT NULL);



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_user_id" ON "public"."orders" USING "btree" ("user_id");



CREATE INDEX "idx_payment_splits_vendor_id" ON "public"."payment_splits" USING "btree" ("vendor_id");



CREATE INDEX "idx_payments_order_id" ON "public"."payments" USING "btree" ("order_id");



CREATE INDEX "idx_payments_status" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "idx_product_complements_complement_product_id" ON "public"."product_complements" USING "btree" ("complement_product_id");



CREATE INDEX "idx_product_complements_display_order" ON "public"."product_complements" USING "btree" ("product_id", "display_order");



CREATE INDEX "idx_product_complements_product_id" ON "public"."product_complements" USING "btree" ("product_id");



CREATE INDEX "idx_product_customisations_customisation_id" ON "public"."product_customisations" USING "btree" ("customisation_id");



CREATE INDEX "idx_product_customisations_product_id" ON "public"."product_customisations" USING "btree" ("product_id");



CREATE INDEX "idx_product_step_options_product_id" ON "public"."product_step_options" USING "btree" ("product_id");



CREATE INDEX "idx_product_step_options_step_ids" ON "public"."product_step_options" USING "gin" ("step_ids");



CREATE INDEX "idx_product_step_options_vendor" ON "public"."product_step_options" USING "btree" ("vendor_id");



CREATE INDEX "idx_product_step_options_vendor_product" ON "public"."product_step_options" USING "btree" ("vendor_id", "product_id");



CREATE INDEX "idx_product_steps_product_id" ON "public"."product_steps" USING "btree" ("product_id");



CREATE INDEX "idx_products_category_id" ON "public"."products" USING "btree" ("category_id");



CREATE INDEX "idx_products_display_order" ON "public"."products" USING "btree" ("category_id", "display_order");



CREATE INDEX "idx_products_is_multi_step" ON "public"."products" USING "btree" ("is_multi_step");



CREATE INDEX "idx_products_vendor_id" ON "public"."products" USING "btree" ("vendor_id");



CREATE INDEX "idx_vendor_admin_users_active" ON "public"."vendor_admin_users" USING "btree" ("is_active");



CREATE INDEX "idx_vendor_admin_users_email" ON "public"."vendor_admin_users" USING "btree" ("email");



CREATE INDEX "idx_vendor_admin_users_vendor_id" ON "public"."vendor_admin_users" USING "btree" ("vendor_id");



CREATE UNIQUE INDEX "idx_vendor_metadata_unique_vendor" ON "public"."vendor_metadata" USING "btree" ("vendor_id");



CREATE INDEX "idx_vendor_metadata_vendor_id" ON "public"."vendor_metadata" USING "btree" ("vendor_id");



CREATE INDEX "idx_vendor_stuart_settings_vendor_id" ON "public"."vendor_stuart_settings" USING "btree" ("vendor_id");



CREATE UNIQUE INDEX "uq_order_deliveries_order_id" ON "public"."order_deliveries" USING "btree" ("order_id");



CREATE UNIQUE INDEX "vendors_custom_domain_unique" ON "public"."vendors" USING "btree" ("lower"("customDomain")) WHERE ("customDomain" IS NOT NULL);



CREATE OR REPLACE TRIGGER "trg_vendor_pg_creds_updated" BEFORE UPDATE ON "public"."vendor_paygreen_credentials" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_banners_updated_at" BEFORE UPDATE ON "public"."banners" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_customisation_options_updated_at" BEFORE UPDATE ON "public"."customisation_options" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_customisations_updated_at" BEFORE UPDATE ON "public"."customisations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_listings_updated_at" BEFORE UPDATE ON "public"."listings" FOR EACH ROW EXECUTE FUNCTION "public"."update_listings_updated_at"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_product_complements_updated_at" BEFORE UPDATE ON "public"."product_complements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vendor_admin_users_updated_at" BEFORE UPDATE ON "public"."vendor_admin_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vendors_updated_at" BEFORE UPDATE ON "public"."vendors" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."business_hours"
    ADD CONSTRAINT "business_hours_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."customisation_options"
    ADD CONSTRAINT "customisation_options_customisation_id_fkey" FOREIGN KEY ("customisation_id") REFERENCES "public"."customisations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customisation_options"
    ADD CONSTRAINT "customisation_options_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customisations"
    ADD CONSTRAINT "customisations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."banners"
    ADD CONSTRAINT "fk_banners_vendor_id" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_step_options"
    ADD CONSTRAINT "fk_product_step_options_vendor" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_owner_fkey" FOREIGN KEY ("owner") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_deliveries"
    ADD CONSTRAINT "order_deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_complements"
    ADD CONSTRAINT "order_item_complements_complement_product_id_fkey" FOREIGN KEY ("complement_product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."order_item_complements"
    ADD CONSTRAINT "order_item_complements_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."payment_splits"
    ADD CONSTRAINT "payment_splits_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_splits"
    ADD CONSTRAINT "payment_splits_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_complements"
    ADD CONSTRAINT "product_complements_complement_product_id_fkey" FOREIGN KEY ("complement_product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_complements"
    ADD CONSTRAINT "product_complements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_customisations"
    ADD CONSTRAINT "product_customisations_customisation_id_fkey" FOREIGN KEY ("customisation_id") REFERENCES "public"."customisations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_customisations"
    ADD CONSTRAINT "product_customisations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_options"
    ADD CONSTRAINT "product_options_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_step_options"
    ADD CONSTRAINT "product_step_options_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_steps"
    ADD CONSTRAINT "product_steps_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_admin_users"
    ADD CONSTRAINT "vendor_admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_admin_users"
    ADD CONSTRAINT "vendor_admin_users_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_metadata"
    ADD CONSTRAINT "vendor_metadata_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_paygreen_credentials"
    ADD CONSTRAINT "vendor_paygreen_credentials_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_stuart_settings"
    ADD CONSTRAINT "vendor_stuart_settings_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow all order updates for development" ON "public"."orders" FOR UPDATE USING (true);



CREATE POLICY "Allow all payment operations for development" ON "public"."payments" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to delete business hours" ON "public"."business_hours" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to delete vendor metadata" ON "public"."vendor_metadata" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to insert business hours" ON "public"."business_hours" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to update business hours" ON "public"."business_hours" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow order status updates for development" ON "public"."orders" FOR UPDATE USING (true);



CREATE POLICY "Allow public read access to business hours" ON "public"."business_hours" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow public read access to vendor metadata" ON "public"."vendor_metadata" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow vendor admin access" ON "public"."vendor_admin_users" USING (true);



CREATE POLICY "Anyone can view published listings" ON "public"."listings" FOR SELECT USING (("published" = true));



CREATE POLICY "Authenticated users can become vendors" ON "public"."vendors" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can insert orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Dev mode - full access to products" ON "public"."products" USING (true) WITH CHECK (true);



CREATE POLICY "Public can create order items" ON "public"."order_items" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can create orders" ON "public"."orders" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can create users during signup" ON "public"."users" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can insert order item complements" ON "public"."order_item_complements" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can insert order items" ON "public"."order_items" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can insert orders" ON "public"."orders" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can select order item complements" ON "public"."order_item_complements" FOR SELECT USING (true);



CREATE POLICY "Public can select order items" ON "public"."order_items" FOR SELECT USING (true);



CREATE POLICY "Public can select orders" ON "public"."orders" FOR SELECT USING (true);



CREATE POLICY "Public can view active banners" ON "public"."banners" FOR SELECT USING ((("is_active" = true) AND (("starts_at" IS NULL) OR ("starts_at" <= "now"())) AND (("ends_at" IS NULL) OR ("ends_at" >= "now"()))));



CREATE POLICY "Public can view active categories" ON "public"."categories" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view active vendors" ON "public"."vendors" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view available product options" ON "public"."product_options" FOR SELECT USING (("is_available" = true));



CREATE POLICY "Service role can manage all orders" ON "public"."orders" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can delete their own listings" ON "public"."listings" FOR DELETE USING (("auth"."uid"() = "owner"));



CREATE POLICY "Users can insert their own listings" ON "public"."listings" FOR INSERT WITH CHECK (("auth"."uid"() = "owner"));



CREATE POLICY "Users can insert their own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update order items from their orders" ON "public"."order_items" FOR UPDATE USING ("public"."order_item_belongs_to_user"("order_id"));



CREATE POLICY "Users can update their own listings" ON "public"."listings" FOR UPDATE USING (("auth"."uid"() = "owner"));



CREATE POLICY "Users can update their own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view order items from their orders" ON "public"."order_items" FOR SELECT USING ("public"."order_item_belongs_to_user"("order_id"));



CREATE POLICY "Users can view their order items" ON "public"."order_items" FOR SELECT USING ("public"."user_owns_order"("order_id"));



CREATE POLICY "Users can view their own listings" ON "public"."listings" FOR SELECT USING (("auth"."uid"() = "owner"));



CREATE POLICY "Users can view their own orders" ON "public"."orders" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("auth"."uid"() IS NULL)));



CREATE POLICY "Users can view their own payments" ON "public"."payments" FOR SELECT USING (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own profile" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Vendors can manage options for their products" ON "public"."product_options" USING (("product_id" IN ( SELECT "products"."id"
   FROM "public"."products"
  WHERE ("products"."vendor_id" IN ( SELECT "vendors"."id"
           FROM "public"."vendors"
          WHERE ("vendors"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Vendors can update their order items" ON "public"."order_items" FOR UPDATE USING ("public"."user_is_vendor_for_order_item"("vendor_id"));



CREATE POLICY "Vendors can update their own profile" ON "public"."vendors" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Vendors can view orders with their products" ON "public"."orders" FOR SELECT USING ("public"."is_vendor_order"("id"));



CREATE POLICY "Vendors can view payments for their orders" ON "public"."payments" FOR SELECT USING (("order_id" IN ( SELECT DISTINCT "o"."id"
   FROM ("public"."orders" "o"
     JOIN "public"."order_items" "oi" ON (("o"."id" = "oi"."order_id")))
  WHERE ("oi"."vendor_id" IN ( SELECT "vendors"."id"
           FROM "public"."vendors"
          WHERE ("vendors"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Vendors can view their order items" ON "public"."order_items" FOR SELECT USING ("public"."user_is_vendor_for_order_item"("vendor_id"));



CREATE POLICY "Vendors can view their payment splits" ON "public"."payment_splits" FOR SELECT USING (("vendor_id" IN ( SELECT "vendors"."id"
   FROM "public"."vendors"
  WHERE ("vendors"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."banners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_hours" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_hours_delete_policy" ON "public"."business_hours" FOR DELETE TO "authenticated" USING (("vendor_id" IN ( SELECT "vendor_admin_users"."vendor_id"
   FROM "public"."vendor_admin_users"
  WHERE ("vendor_admin_users"."id" = "auth"."uid"()))));



CREATE POLICY "business_hours_insert_policy" ON "public"."business_hours" FOR INSERT TO "authenticated" WITH CHECK (("vendor_id" IN ( SELECT "vendor_admin_users"."vendor_id"
   FROM "public"."vendor_admin_users"
  WHERE ("vendor_admin_users"."id" = "auth"."uid"()))));



CREATE POLICY "business_hours_select_policy" ON "public"."business_hours" FOR SELECT TO "authenticated" USING (("vendor_id" IN ( SELECT "vendor_admin_users"."vendor_id"
   FROM "public"."vendor_admin_users"
  WHERE ("vendor_admin_users"."id" = "auth"."uid"()))));



CREATE POLICY "business_hours_update_policy" ON "public"."business_hours" FOR UPDATE TO "authenticated" USING (("vendor_id" IN ( SELECT "vendor_admin_users"."vendor_id"
   FROM "public"."vendor_admin_users"
  WHERE ("vendor_admin_users"."id" = "auth"."uid"())))) WITH CHECK (("vendor_id" IN ( SELECT "vendor_admin_users"."vendor_id"
   FROM "public"."vendor_admin_users"
  WHERE ("vendor_admin_users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_deliveries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_deliveries_insert_public" ON "public"."order_deliveries" FOR INSERT WITH CHECK (true);



CREATE POLICY "order_deliveries_select_public" ON "public"."order_deliveries" FOR SELECT USING (true);



CREATE POLICY "order_deliveries_update_public" ON "public"."order_deliveries" FOR UPDATE USING (true);



ALTER TABLE "public"."order_item_complements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_splits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_read" ON "public"."vendor_paygreen_credentials" FOR SELECT USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendor_admin_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendor_paygreen_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendor_stuart_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vendor_stuart_settings_insert_public" ON "public"."vendor_stuart_settings" FOR INSERT WITH CHECK (true);



CREATE POLICY "vendor_stuart_settings_select_public" ON "public"."vendor_stuart_settings" FOR SELECT USING (true);



CREATE POLICY "vendor_stuart_settings_update_public" ON "public"."vendor_stuart_settings" FOR UPDATE USING (true);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_vendor_order"("order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_vendor_order"("order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_vendor_order"("order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."order_item_belongs_to_user"("item_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."order_item_belongs_to_user"("item_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."order_item_belongs_to_user"("item_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_listings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_listings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_listings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_vendor_for_order_item"("item_vendor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_vendor_for_order_item"("item_vendor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_vendor_for_order_item"("item_vendor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_owns_order"("order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_owns_order"("order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_owns_order"("order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."vendor_has_items_in_order"("order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."vendor_has_items_in_order"("order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vendor_has_items_in_order"("order_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."banners" TO "anon";
GRANT ALL ON TABLE "public"."banners" TO "authenticated";
GRANT ALL ON TABLE "public"."banners" TO "service_role";



GRANT ALL ON SEQUENCE "public"."banners_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."banners_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."banners_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."business_hours" TO "anon";
GRANT ALL ON TABLE "public"."business_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."business_hours" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customisation_options" TO "anon";
GRANT ALL ON TABLE "public"."customisation_options" TO "authenticated";
GRANT ALL ON TABLE "public"."customisation_options" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customisation_options_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customisation_options_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customisation_options_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customisations" TO "anon";
GRANT ALL ON TABLE "public"."customisations" TO "authenticated";
GRANT ALL ON TABLE "public"."customisations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customisations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customisations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customisations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "anon";
GRANT ALL ON TABLE "public"."listings" TO "authenticated";
GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON TABLE "public"."order_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."order_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."order_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."order_item_complements" TO "anon";
GRANT ALL ON TABLE "public"."order_item_complements" TO "authenticated";
GRANT ALL ON TABLE "public"."order_item_complements" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payment_splits" TO "anon";
GRANT ALL ON TABLE "public"."payment_splits" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_splits" TO "service_role";



GRANT ALL ON SEQUENCE "public"."payment_splits_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payment_splits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payment_splits_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."product_complements" TO "anon";
GRANT ALL ON TABLE "public"."product_complements" TO "authenticated";
GRANT ALL ON TABLE "public"."product_complements" TO "service_role";



GRANT ALL ON TABLE "public"."product_customisations" TO "anon";
GRANT ALL ON TABLE "public"."product_customisations" TO "authenticated";
GRANT ALL ON TABLE "public"."product_customisations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_customisations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_customisations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_customisations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_options" TO "anon";
GRANT ALL ON TABLE "public"."product_options" TO "authenticated";
GRANT ALL ON TABLE "public"."product_options" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_options_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_options_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_options_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_step_options" TO "anon";
GRANT ALL ON TABLE "public"."product_step_options" TO "authenticated";
GRANT ALL ON TABLE "public"."product_step_options" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_step_options_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_step_options_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_step_options_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_steps" TO "anon";
GRANT ALL ON TABLE "public"."product_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."product_steps" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_steps_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_steps_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_steps_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_admin_users" TO "anon";
GRANT ALL ON TABLE "public"."vendor_admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_metadata" TO "anon";
GRANT ALL ON TABLE "public"."vendor_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_paygreen_credentials" TO "anon";
GRANT ALL ON TABLE "public"."vendor_paygreen_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_paygreen_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_stuart_settings" TO "anon";
GRANT ALL ON TABLE "public"."vendor_stuart_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_stuart_settings" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






