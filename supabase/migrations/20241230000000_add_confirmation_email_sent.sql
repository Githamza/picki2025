-- Add confirmation_email_sent column to orders table
ALTER TABLE orders ADD COLUMN confirmation_email_sent boolean DEFAULT false; 