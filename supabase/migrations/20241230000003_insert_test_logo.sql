-- Update the first vendor with a test logo URL
-- Using a placeholder logo from a reliable source
UPDATE vendors 
SET logo_url = 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200&h=200&fit=crop&auto=format'
WHERE id = (SELECT id FROM vendors ORDER BY created_at LIMIT 1);

-- If no vendors exist, create a test vendor with a logo
INSERT INTO vendors (business_name, business_type, is_active, logo_url, country)
SELECT 'Test Restaurant', 'Restaurant', true, 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200&h=200&fit=crop&auto=format', 'FR'
WHERE NOT EXISTS (SELECT 1 FROM vendors); 