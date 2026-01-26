-- Restructure Antillaise Product (ID: 134) with new 6-step configuration

-- First, delete existing steps and options for Antillaise product
DELETE FROM product_step_options 
WHERE step_id IN (SELECT id FROM product_steps WHERE product_id = 134);

DELETE FROM product_steps WHERE product_id = 134;

-- Step 1: Taille de la box (Required, choose 1)
INSERT INTO product_steps (product_id, display_order, name, description, step_type, is_required, min_selections, max_selections) 
VALUES (134, 1, 'Taille de la box', 'Choisissez-en 1.', 'single-select', true, 1, 1);

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Taille L', 'Box de taille L', 12.90, 'component', 'https://example.com/box-l.jpg', 1, true
FROM product_steps WHERE product_id = 134 AND display_order = 1;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Taille XL', 'Box de taille XL', 14.90, 'component', 'https://example.com/box-xl.jpg', 2, true
FROM product_steps WHERE product_id = 134 AND display_order = 1;

-- Step 2: Je choisis ma protéine (Required, choose 1)
INSERT INTO product_steps (product_id, display_order, name, description, step_type, is_required, min_selections, max_selections) 
VALUES (134, 2, 'Je choisis ma protéine', 'Choisissez-en 1.', 'single-select', true, 1, 1);

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Boeuf Grillé', 'Boeuf grillé savoureux', 1.90, 'component', 'https://example.com/beef-grilled.jpg', 1, true
FROM product_steps WHERE product_id = 134 AND display_order = 2;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Émincé de poulet Grillé', 'Émincé de poulet grillé', 0.00, 'component', 'https://example.com/chicken-sliced.jpg', 2, true
FROM product_steps WHERE product_id = 134 AND display_order = 2;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Végé Allocos ( bananes plantains )', 'Bananes plantains frites', 0.00, 'component', 'https://example.com/allocos.jpg', 3, true
FROM product_steps WHERE product_id = 134 AND display_order = 2;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Végé patates douces', 'Patates douces végétariennes', 0.00, 'component', 'https://example.com/sweet-potato.jpg', 4, true
FROM product_steps WHERE product_id = 134 AND display_order = 2;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Viandes mixtes', 'Mélange de viandes', 2.90, 'component', 'https://example.com/mixed-meat.jpg', 5, true
FROM product_steps WHERE product_id = 134 AND display_order = 2;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'boeuf grillée', 'Boeuf grillé (option 2)', 1.90, 'component', 'https://example.com/beef-grilled-2.jpg', 6, true
FROM product_steps WHERE product_id = 134 AND display_order = 2;

-- Step 3: Je choisis mes extras (Optional, max 6)
INSERT INTO product_steps (product_id, display_order, name, description, step_type, is_required, min_selections, max_selections) 
VALUES (134, 3, 'je choisis mes extras', 'Choisissez-en 6 max.', 'multi-select', false, 0, 6);

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Poulet Frit x3', '3 pièces de poulet frit', 5.90, 'component', 'https://example.com/fried-chicken.jpg', 1, true
FROM product_steps WHERE product_id = 134 AND display_order = 3;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Allocos', 'Bananes plantains frites', 5.90, 'component', 'https://example.com/allocos-extra.jpg', 2, true
FROM product_steps WHERE product_id = 134 AND display_order = 3;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Frite de patates douces', 'Frites de patates douces', 5.90, 'component', 'https://example.com/sweet-potato-fries.jpg', 3, true
FROM product_steps WHERE product_id = 134 AND display_order = 3;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Samoussa Boeuf x3', '3 samoussas au boeuf', 5.90, 'component', 'https://example.com/samoussa-beef.jpg', 4, true
FROM product_steps WHERE product_id = 134 AND display_order = 3;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Accras x8', '8 accras de légumes', 5.90, 'component', 'https://example.com/accras.jpg', 5, true
FROM product_steps WHERE product_id = 134 AND display_order = 3;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Ailes de poulets marinées x3', '3 ailes de poulet marinées', 5.90, 'component', 'https://example.com/chicken-wings.jpg', 6, true
FROM product_steps WHERE product_id = 134 AND display_order = 3;

-- Step 4: Des suppléments ? (Optional, max 5)
INSERT INTO product_steps (product_id, display_order, name, description, step_type, is_required, min_selections, max_selections) 
VALUES (134, 4, 'Des suppléments ?', 'Choisissez-en 5 max.', 'multi-select', false, 0, 5);

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Suppléments Viandes', 'Supplément de viandes', 4.50, 'component', 'https://example.com/meat-supplement.jpg', 1, true
FROM product_steps WHERE product_id = 134 AND display_order = 4;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Suppléments sauces', 'Supplément de sauces', 2.50, 'component', 'https://example.com/sauce-supplement.jpg', 2, true
FROM product_steps WHERE product_id = 134 AND display_order = 4;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Supplément riz', 'Supplément de riz parfumé', 3.00, 'component', 'https://example.com/rice-supplement.jpg', 3, true
FROM product_steps WHERE product_id = 134 AND display_order = 4;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'sauce piment ( fait maison )', 'Sauce piment artisanale', 0.90, 'component', 'https://example.com/hot-sauce.jpg', 4, true
FROM product_steps WHERE product_id = 134 AND display_order = 4;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Oignons frit', 'Oignons frits croustillants', 0.50, 'component', 'https://example.com/fried-onions.jpg', 5, true
FROM product_steps WHERE product_id = 134 AND display_order = 4;

-- Step 5: Une boisson ? (Optional, max 14) - Same as Mafé and Yassa
INSERT INTO product_steps (product_id, display_order, name, description, step_type, is_required, min_selections, max_selections) 
VALUES (134, 5, 'Une boisson ?', 'Choisissez-en 14 max.', 'multi-select', false, 0, 14);

-- Insert all drink options (same as Mafé and Yassa)
INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Jus de Bissap ( fait maison )', 'Jus de bissap artisanal', 3.90, 'component', 'https://example.com/bissap-juice.jpg', 1, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Jus de Gingembre ( fait maison )', 'Jus de gingembre artisanal', 5.90, 'component', 'https://example.com/ginger-juice.jpg', 2, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Caraïbos goyave', 'Boisson Caraïbos goyave', 2.90, 'component', 'https://example.com/caribos-guava.jpg', 3, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Caraïbos mangue', 'Boisson Caraïbos mangue', 2.90, 'component', 'https://example.com/caribos-mango.jpg', 4, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Fanta Dragon', 'Fanta saveur dragon', 2.90, 'component', 'https://example.com/fanta-dragon.jpg', 5, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Coca Cola', 'Coca-Cola classique', 2.90, 'component', 'https://example.com/coca-cola.jpg', 6, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Orangina', 'Orangina pétillante', 2.90, 'component', 'https://example.com/orangina.jpg', 7, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Ice Tea', 'Thé glacé', 2.90, 'component', 'https://example.com/ice-tea.jpg', 8, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Oasis Tropicale', 'Oasis saveur tropicale', 2.90, 'component', 'https://example.com/oasis-tropical.jpg', 9, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Hawai', 'Boisson Hawai', 2.90, 'component', 'https://example.com/hawai.jpg', 10, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Coca Cola Zéro', 'Coca-Cola sans sucre', 2.90, 'component', 'https://example.com/coca-zero.jpg', 11, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Dada litchi', 'Boisson Dada litchi', 2.90, 'component', 'https://example.com/dada-litchi.jpg', 12, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Eau plate', 'Eau plate', 2.50, 'component', 'https://example.com/water.jpg', 13, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT ps.id, NULL, 'Pepsi', 'Pepsi Cola', 2.90, 'component', 'https://example.com/pepsi.jpg', 14, true
FROM product_steps ps WHERE ps.product_id = 134 AND ps.display_order = 5;

-- Step 6: Un dessert ? (Optional, max 1)
INSERT INTO product_steps (product_id, display_order, name, description, step_type, is_required, min_selections, max_selections) 
VALUES (134, 6, 'Un dessert ?', 'Choisissez-en 1 max.', 'single-select', false, 0, 1);

INSERT INTO product_step_options (step_id, product_id, name, description, price_adjustment, option_type, image_url, display_order, is_available)
SELECT id, NULL, 'Tiramisu spéculos caramel ( fait maison )', 'Tiramisu artisanal aux spéculos et caramel', 3.90, 'component', 'https://example.com/tiramisu-speculoos.jpg', 1, true
FROM product_steps WHERE product_id = 134 AND display_order = 6; 