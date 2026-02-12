-- Add info message columns to vendors table
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS info_message text,
  ADD COLUMN IF NOT EXISTS info_message_enabled boolean NOT NULL DEFAULT false;
