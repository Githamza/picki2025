-- Migration: Consolidate menus into products table
-- This script migrates menus to products and renames step tables

BEGIN;

-- 1. Add isMultiStep column to products table
ALTER TABLE products ADD COLUMN is_multi_step BOOLEAN DEFAULT FALSE;

-- 2. Migrate all menus to products table with is_multi_step = true
INSERT INTO products (
  name, 
  price, 
  image_url, 
  category_id, 
  vendor_id, 
  description, 
  short_description, 
  long_description,
  is_available,
  is_multi_step,
  created_at,
  updated_at
)
SELECT 
  name,
  COALESCE(price, 0),
  image_url,
  category_id,
  vendor_id,
  description,
  short_description,
  description as long_description,
  is_active as is_available,
  TRUE as is_multi_step,
  created_at,
  updated_at
FROM menus;

-- 3. Create a mapping table to track old menu_id -> new product_id
CREATE TEMP TABLE menu_to_product_mapping AS
SELECT 
  m.id as old_menu_id,
  p.id as new_product_id
FROM menus m
JOIN products p ON (
  p.name = m.name 
  AND p.vendor_id = m.vendor_id 
  AND p.is_multi_step = TRUE
  AND p.created_at = m.created_at
);

-- 4. Rename menu_steps to product_steps and update foreign keys
CREATE TABLE product_steps (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Copy data from menu_steps to product_steps with updated foreign keys
INSERT INTO product_steps (id, product_id, name, display_order, created_at, updated_at)
SELECT 
  ms.id,
  mp.new_product_id,
  ms.name,
  ms.display_order,
  ms.created_at,
  ms.updated_at
FROM menu_steps ms
JOIN menu_to_product_mapping mp ON ms.menu_id = mp.old_menu_id;

-- 5. Rename menu_step_options to product_step_options
CREATE TABLE product_step_options (
  id SERIAL PRIMARY KEY,
  step_id INTEGER NOT NULL REFERENCES product_steps(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price_adjustment DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Copy data from menu_step_options to product_step_options
INSERT INTO product_step_options (id, step_id, product_id, name, price_adjustment, created_at, updated_at)
SELECT 
  mso.id,
  mso.step_id,
  mso.product_id,
  mso.name,
  mso.price_adjustment,
  mso.created_at,
  mso.updated_at
FROM menu_step_options mso;

-- 6. Update sequences to continue from current max IDs
SELECT setval('product_steps_id_seq', (SELECT MAX(id) FROM product_steps));
SELECT setval('product_step_options_id_seq', (SELECT MAX(id) FROM product_step_options));

-- 7. Drop old tables
DROP TABLE menu_step_options;
DROP TABLE menu_steps;
DROP TABLE menus;

-- 8. Add indexes for performance
CREATE INDEX idx_products_is_multi_step ON products(is_multi_step);
CREATE INDEX idx_product_steps_product_id ON product_steps(product_id);
CREATE INDEX idx_product_step_options_step_id ON product_step_options(step_id);
CREATE INDEX idx_product_step_options_product_id ON product_step_options(product_id);

COMMIT; 