-- Fix product_step_options to reference individual products instead of multi-step product
-- This migration creates individual products for each dish option and updates step options

-- First, create individual products for each dish option
-- These will be referenced by the step options to get correct images

-- 1. Create Ka Praow product (for Plat step)
INSERT INTO products (
  name, 
  description, 
  price, 
  vendor_id, 
  image_url, 
  is_available,
  is_multi_step,
  created_at,
  updated_at
) VALUES (
  'Ka Praow', 
  'Traditional Thai basil stir-fry with minced meat', 
  14.90, 
  '5df39d64-311e-405a-8fc7-ec975d82def8', -- Ka Praow vendor ID
  'https://images.unsplash.com/photo-1569059588025-04c8d4c84a7c?w=400&h=300&fit=crop&auto=format', 
  true,
  false,
  NOW(),
  NOW()
);

-- 2. Create Pad Thai product (for Plat step)
INSERT INTO products (
  name, 
  description, 
  price, 
  vendor_id, 
  image_url, 
  is_available,
  is_multi_step,
  created_at,
  updated_at
) VALUES (
  'Pad Thai', 
  'Classic Thai stir-fried noodles with shrimp and peanuts', 
  15.90, 
  '5df39d64-311e-405a-8fc7-ec975d82def8', -- Ka Praow vendor ID
  'https://images.unsplash.com/photo-1559314809-0f31657b5d8e?w=400&h=300&fit=crop&auto=format', 
  true,
  false,
  NOW(),
  NOW()
);

-- 3. Create Green Curry product (for Plat step)
INSERT INTO products (
  name, 
  description, 
  price, 
  vendor_id, 
  image_url, 
  is_available,
  is_multi_step,
  created_at,
  updated_at
) VALUES (
  'Green Curry', 
  'Spicy Thai green curry with coconut milk and vegetables', 
  16.90, 
  '5df39d64-311e-405a-8fc7-ec975d82def8', -- Ka Praow vendor ID
  'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&h=300&fit=crop&auto=format', 
  true,
  false,
  NOW(),
  NOW()
);

-- 4. Create Ice Cream product (for Dessert step)
INSERT INTO products (
  name, 
  description, 
  price, 
  vendor_id, 
  image_url, 
  is_available,
  is_multi_step,
  created_at,
  updated_at
) VALUES (
  'Ice Cream', 
  'Vanilla ice cream with toppings', 
  4.50, 
  '5df39d64-311e-405a-8fc7-ec975d82def8', -- Ka Praow vendor ID
  'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&h=300&fit=crop&auto=format', 
  true,
  false,
  NOW(),
  NOW()
);

-- 5. Create Mango Sticky Rice product (for Dessert step)
INSERT INTO products (
  name, 
  description, 
  price, 
  vendor_id, 
  image_url, 
  is_available,
  is_multi_step,
  created_at,
  updated_at
) VALUES (
  'Mango Sticky Rice', 
  'Traditional Thai dessert with sweet coconut rice and fresh mango', 
  6.90, 
  '5df39d64-311e-405a-8fc7-ec975d82def8', -- Ka Praow vendor ID
  'https://images.unsplash.com/photo-1541833747-9e5ae6ad8cca?w=400&h=300&fit=crop&auto=format', 
  true,
  false,
  NOW(),
  NOW()
);

-- Now update the product_step_options to reference these individual products
-- We'll use the product names to match the options

-- Update Ka Praow option
UPDATE product_step_options 
SET product_id = (SELECT id FROM products WHERE name = 'Ka Praow' AND vendor_id = '5df39d64-311e-405a-8fc7-ec975d82def8' ORDER BY created_at DESC LIMIT 1)
WHERE name = 'Ka Praow';

-- Update Pad Thai option
UPDATE product_step_options 
SET product_id = (SELECT id FROM products WHERE name = 'Pad Thai' AND vendor_id = '5df39d64-311e-405a-8fc7-ec975d82def8' ORDER BY created_at DESC LIMIT 1)
WHERE name = 'Pad Thai';

-- Update Green Curry option (if it exists)
UPDATE product_step_options 
SET product_id = (SELECT id FROM products WHERE name = 'Green Curry' AND vendor_id = '5df39d64-311e-405a-8fc7-ec975d82def8' ORDER BY created_at DESC LIMIT 1)
WHERE name = 'Green Curry';

-- Update Ice Cream option
UPDATE product_step_options 
SET product_id = (SELECT id FROM products WHERE name = 'Ice Cream' AND vendor_id = '5df39d64-311e-405a-8fc7-ec975d82def8' ORDER BY created_at DESC LIMIT 1)
WHERE name = 'Ice Cream';

-- Update Mango Sticky Rice option (if it exists)
UPDATE product_step_options 
SET product_id = (SELECT id FROM products WHERE name = 'Mango Sticky Rice' AND vendor_id = '5df39d64-311e-405a-8fc7-ec975d82def8' ORDER BY created_at DESC LIMIT 1)
WHERE name = 'Mango Sticky Rice';

-- Add comment for documentation
COMMENT ON TABLE product_step_options IS 'Options for product steps - each option references an individual product via product_id to get images and pricing'; 