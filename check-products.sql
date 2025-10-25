-- Check remaining legranola products
SELECT 
  p.id,
  p.name,
  c.name as category,
  p.price,
  p.is_available,
  p.display_order
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.vendor_id = '60cc15ad-fe97-4393-b598-b7ccab230464'
ORDER BY p.display_order
LIMIT 70;

