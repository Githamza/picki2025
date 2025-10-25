-- Add ready_email_sent column to orders table
ALTER TABLE orders ADD COLUMN ready_email_sent boolean DEFAULT false; 