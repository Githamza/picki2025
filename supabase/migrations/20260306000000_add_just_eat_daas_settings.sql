-- Migration: Add vendor_just_eat_daas_settings table
-- This table stores Just Eat DaaS collect point configuration per vendor.
-- Each vendor that uses Just Eat DaaS must be pre-registered with Just Eat
-- as a "collect point" (pickup location). The resulting UUID is stored here.

CREATE TABLE IF NOT EXISTS "public"."vendor_just_eat_daas_settings" (
    "vendor_id"        uuid NOT NULL,
    "collect_point_id" text NOT NULL,
    "tenant"           text NOT NULL DEFAULT 'uk',
    "created_at"       timestamp with time zone DEFAULT now(),
    "updated_at"       timestamp with time zone DEFAULT now(),
    CONSTRAINT "vendor_just_eat_daas_settings_pkey" PRIMARY KEY ("vendor_id"),
    CONSTRAINT "vendor_just_eat_daas_settings_vendor_id_fkey"
        FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE,
    CONSTRAINT "vendor_just_eat_daas_settings_tenant_check"
        CHECK ("tenant" = ANY (ARRAY['uk'::text, 'ca'::text, 'au'::text, 'ie'::text]))
);

ALTER TABLE "public"."vendor_just_eat_daas_settings" OWNER TO "postgres";

COMMENT ON TABLE "public"."vendor_just_eat_daas_settings" IS
    'Stores the Just Eat DaaS collect point ID for each vendor. '
    'The collect_point_id is a UUID assigned by Just Eat when a restaurant is '
    'registered as a collect (pickup) point in the DaaS system.';

COMMENT ON COLUMN "public"."vendor_just_eat_daas_settings"."collect_point_id" IS
    'UUID assigned by Just Eat DaaS when the restaurant is registered as a collect point.';

COMMENT ON COLUMN "public"."vendor_just_eat_daas_settings"."tenant" IS
    'Just Eat market code: uk, ca, au, ie.';

-- RLS policies (follow same pattern as vendor_paygreen_credentials)
ALTER TABLE "public"."vendor_just_eat_daas_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to just eat daas settings"
    ON "public"."vendor_just_eat_daas_settings"
    FOR SELECT TO "authenticated", "anon"
    USING (true);

CREATE POLICY "Allow authenticated users to insert just eat daas settings"
    ON "public"."vendor_just_eat_daas_settings"
    FOR INSERT TO "authenticated"
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update just eat daas settings"
    ON "public"."vendor_just_eat_daas_settings"
    FOR UPDATE TO "authenticated"
    USING (true);

CREATE POLICY "Allow authenticated users to delete just eat daas settings"
    ON "public"."vendor_just_eat_daas_settings"
    FOR DELETE TO "authenticated"
    USING (true);

-- Grants
GRANT ALL ON TABLE "public"."vendor_just_eat_daas_settings" TO "anon";
GRANT ALL ON TABLE "public"."vendor_just_eat_daas_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_just_eat_daas_settings" TO "service_role";

-- Index for vendor_id lookups
CREATE INDEX IF NOT EXISTS "idx_vendor_just_eat_daas_settings_vendor_id"
    ON "public"."vendor_just_eat_daas_settings" USING btree ("vendor_id");
