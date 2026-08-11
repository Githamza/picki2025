-- Migration: Add category_type to categories (SPEC-UPSELL.md, T1)
-- Description: Fixed classification of a category's role on the menu, used to
-- derive the upsell suggestion pool (v1: boisson + dessert). Nullable with no
-- default: untyped categories never enter the pool, so existing vendors see
-- zero behavior change until they classify their categories. text + CHECK
-- rather than a Postgres enum so extending the list later is a constraint
-- swap. Readable through the existing categories select policy and writable
-- through the existing vendor insert/update policies (no policy change).

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS category_type text
CHECK (category_type IN ('entree', 'plat', 'boisson', 'dessert', 'sauce', 'accompagnement', 'autre'));

COMMENT ON COLUMN categories.category_type IS
  'Menu role of this category: entree | plat | boisson | dessert | sauce | accompagnement | autre. Drives the upsell pool (v1: boisson + dessert). NULL = unclassified, excluded from upsell.';
