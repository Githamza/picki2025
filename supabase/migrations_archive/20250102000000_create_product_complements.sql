-- Create product complements system
-- This allows products to have complementary items (which are other products)

-- Table to link products to their available complements
CREATE TABLE product_complements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  complement_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT FALSE,
  selection_type TEXT CHECK (selection_type IN ('single', 'multiple')) DEFAULT 'single',
  max_selections INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  -- Override pricing for complement when linked to this product
  custom_price DECIMAL(10,2) NULL, -- NULL means use original product price
  is_free BOOLEAN DEFAULT FALSE, -- Override to make it free
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure a product can't be its own complement
  CHECK (product_id != complement_product_id),
  -- Unique constraint to prevent duplicate complement assignments
  UNIQUE(product_id, complement_product_id)
);

-- Table to track complement selections in orders
CREATE TABLE order_item_complements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  complement_product_id INTEGER NOT NULL REFERENCES products(id),
  complement_name TEXT NOT NULL, -- Store name at time of order
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL, -- Price at time of order
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_product_complements_product_id ON product_complements(product_id);
CREATE INDEX idx_product_complements_complement_product_id ON product_complements(complement_product_id);
CREATE INDEX idx_product_complements_display_order ON product_complements(product_id, display_order);
CREATE INDEX idx_order_item_complements_order_item_id ON order_item_complements(order_item_id);

-- Add updated_at trigger for product_complements
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_product_complements_updated_at 
    BEFORE UPDATE ON product_complements 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE product_complements IS 'Links products to their available complement products (e.g., sauce with burger)';
COMMENT ON COLUMN product_complements.is_required IS 'Whether selecting a complement is mandatory for this product';
COMMENT ON COLUMN product_complements.selection_type IS 'Whether user can select single or multiple complements';
COMMENT ON COLUMN product_complements.max_selections IS 'Maximum number of complements that can be selected';
COMMENT ON COLUMN product_complements.custom_price IS 'Override price for complement when linked to this product (NULL uses original price)';
COMMENT ON COLUMN product_complements.is_free IS 'Make complement free when linked to this product';

COMMENT ON TABLE order_item_complements IS 'Tracks which complements were selected for each order item';
COMMENT ON COLUMN order_item_complements.complement_name IS 'Name of complement at time of order (for historical accuracy)';
COMMENT ON COLUMN order_item_complements.unit_price IS 'Price per complement unit at time of order';
COMMENT ON COLUMN order_item_complements.total_price IS 'Total price for this complement selection (unit_price * quantity)'; 