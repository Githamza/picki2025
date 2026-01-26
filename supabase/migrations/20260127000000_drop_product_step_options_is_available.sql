-- Remove is_available from product_step_options.
-- Availability is now derived from the linked product's is_available field.
-- Component-type options (no linked product) are always considered available.

ALTER TABLE product_step_options DROP COLUMN IF EXISTS is_available;
