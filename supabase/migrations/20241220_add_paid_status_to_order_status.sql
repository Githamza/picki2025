-- Add 'paid' status to order_status enum
ALTER TYPE order_status ADD VALUE 'paid' AFTER 'initiated';

