-- Add comment field to order_items table
ALTER TABLE order_items 
ADD COLUMN comment TEXT;

-- Add index for better performance when querying comments
CREATE INDEX IF NOT EXISTS idx_order_items_comment ON order_items(comment) WHERE comment IS NOT NULL; 