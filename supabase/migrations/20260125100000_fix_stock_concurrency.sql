-- Fix Stock Concurrency Issues
-- This migration adds atomic stock reservation to prevent overselling

-- ============================================================================
-- 1. ADD CHECK CONSTRAINT TO PREVENT NEGATIVE STOCK
-- Safety net: database will reject any update that would make stock negative
-- ============================================================================
ALTER TABLE products DROP CONSTRAINT IF EXISTS stock_non_negative;
ALTER TABLE products ADD CONSTRAINT stock_non_negative
  CHECK (stock_quantity IS NULL OR stock_quantity >= 0);

-- ============================================================================
-- 2. ATOMIC RESERVE STOCK FOR ORDER
-- This function validates AND decrements stock in a single atomic transaction
-- with row-level locking to prevent race conditions.
-- Called when creating an order - replaces separate validate + decrement calls
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."reserve_stock_for_order"(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item RECORD;
  complement RECORD;
  option_data jsonb;
  step_selection jsonb;
  selected_option jsonb;
  product_id_to_reserve integer;
  current_stock integer;
  product_name text;
  required_qty integer;
  insufficient_items jsonb := '[]'::jsonb;
  reserved_products jsonb := '[]'::jsonb;
  rows_updated integer;
  processed_products integer[] := '{}';
BEGIN
  -- =========================================================================
  -- PHASE 1: Lock all products and validate stock availability
  -- Using FOR UPDATE to lock rows and prevent concurrent modifications
  -- =========================================================================

  -- 1a. Check main products in order_items
  FOR item IN
    SELECT oi.id, oi.product_id, oi.quantity, oi.options
    FROM order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.product_id IS NOT NULL
      AND oi.product_id > 0
  LOOP
    -- Lock and get current stock
    SELECT p.stock_quantity, p.name INTO current_stock, product_name
    FROM products p
    WHERE p.id = item.product_id
    FOR UPDATE;  -- Row-level lock

    -- Only validate if stock is managed (not NULL)
    IF current_stock IS NOT NULL THEN
      IF current_stock < item.quantity THEN
        insufficient_items := insufficient_items || jsonb_build_object(
          'productId', item.product_id,
          'productName', product_name,
          'required', item.quantity,
          'available', current_stock,
          'type', 'main'
        );
      END IF;
    END IF;

    -- Track processed products to avoid duplicate checks
    IF NOT (item.product_id = ANY(processed_products)) THEN
      processed_products := array_append(processed_products, item.product_id);
    END IF;

    -- 1b. Check multi-step option products within this item
    IF item.options IS NOT NULL AND jsonb_typeof(item.options) = 'array' AND jsonb_array_length(item.options) > 0 THEN
      option_data := item.options->0;

      IF option_data ? 'stepSelections' THEN
        FOR step_selection IN SELECT * FROM jsonb_array_elements(option_data->'stepSelections')
        LOOP
          IF step_selection ? 'selectedOptions' THEN
            FOR selected_option IN SELECT * FROM jsonb_array_elements(step_selection->'selectedOptions')
            LOOP
              product_id_to_reserve := (selected_option->>'productId')::integer;

              IF product_id_to_reserve IS NOT NULL
                 AND product_id_to_reserve > 0
                 AND NOT (product_id_to_reserve = ANY(processed_products)) THEN

                SELECT p.stock_quantity, p.name INTO current_stock, product_name
                FROM products p
                WHERE p.id = product_id_to_reserve
                FOR UPDATE;

                IF current_stock IS NOT NULL AND current_stock < item.quantity THEN
                  insufficient_items := insufficient_items || jsonb_build_object(
                    'productId', product_id_to_reserve,
                    'productName', product_name,
                    'required', item.quantity,
                    'available', current_stock,
                    'type', 'multi_step_option'
                  );
                END IF;

                processed_products := array_append(processed_products, product_id_to_reserve);
              END IF;
            END LOOP;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  -- 1c. Check complement products
  FOR complement IN
    SELECT oic.complement_product_id, oic.quantity
    FROM order_item_complements oic
    JOIN order_items oi ON oi.id = oic.order_item_id
    WHERE oi.order_id = p_order_id
      AND oic.complement_product_id IS NOT NULL
      AND NOT (oic.complement_product_id = ANY(processed_products))
  LOOP
    SELECT p.stock_quantity, p.name INTO current_stock, product_name
    FROM products p
    WHERE p.id = complement.complement_product_id
    FOR UPDATE;

    IF current_stock IS NOT NULL AND current_stock < complement.quantity THEN
      insufficient_items := insufficient_items || jsonb_build_object(
        'productId', complement.complement_product_id,
        'productName', product_name,
        'required', complement.quantity,
        'available', current_stock,
        'type', 'complement'
      );
    END IF;

    processed_products := array_append(processed_products, complement.complement_product_id);
  END LOOP;

  -- =========================================================================
  -- PHASE 2: If any stock is insufficient, ABORT without decrementing
  -- =========================================================================
  IF jsonb_array_length(insufficient_items) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'orderId', p_order_id,
      'insufficientItems', insufficient_items,
      'reservedProducts', '[]'::jsonb
    );
  END IF;

  -- =========================================================================
  -- PHASE 3: All stock validated - now decrement atomically
  -- Rows are already locked from Phase 1, so no race condition possible
  -- =========================================================================

  -- Reset processed products for decrement phase
  processed_products := '{}';

  -- 3a. Decrement main products
  FOR item IN
    SELECT oi.id, oi.product_id, oi.quantity, oi.options
    FROM order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.product_id IS NOT NULL
      AND oi.product_id > 0
  LOOP
    UPDATE products
    SET stock_quantity = stock_quantity - item.quantity,
        updated_at = NOW()
    WHERE id = item.product_id
      AND stock_quantity IS NOT NULL;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    IF rows_updated > 0 THEN
      reserved_products := reserved_products || jsonb_build_object(
        'productId', item.product_id,
        'quantity', item.quantity,
        'type', 'main'
      );
    END IF;

    -- 3b. Decrement multi-step option products
    IF item.options IS NOT NULL AND jsonb_typeof(item.options) = 'array' AND jsonb_array_length(item.options) > 0 THEN
      option_data := item.options->0;

      IF option_data ? 'stepSelections' THEN
        FOR step_selection IN SELECT * FROM jsonb_array_elements(option_data->'stepSelections')
        LOOP
          IF step_selection ? 'selectedOptions' THEN
            FOR selected_option IN SELECT * FROM jsonb_array_elements(step_selection->'selectedOptions')
            LOOP
              product_id_to_reserve := (selected_option->>'productId')::integer;

              IF product_id_to_reserve IS NOT NULL
                 AND product_id_to_reserve > 0
                 AND NOT (product_id_to_reserve = ANY(processed_products)) THEN

                UPDATE products
                SET stock_quantity = stock_quantity - item.quantity,
                    updated_at = NOW()
                WHERE id = product_id_to_reserve
                  AND stock_quantity IS NOT NULL;

                GET DIAGNOSTICS rows_updated = ROW_COUNT;
                IF rows_updated > 0 THEN
                  reserved_products := reserved_products || jsonb_build_object(
                    'productId', product_id_to_reserve,
                    'quantity', item.quantity,
                    'type', 'multi_step_option'
                  );
                END IF;

                processed_products := array_append(processed_products, product_id_to_reserve);
              END IF;
            END LOOP;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  -- 3c. Decrement complement products
  FOR complement IN
    SELECT oic.complement_product_id, oic.quantity
    FROM order_item_complements oic
    JOIN order_items oi ON oi.id = oic.order_item_id
    WHERE oi.order_id = p_order_id
      AND oic.complement_product_id IS NOT NULL
  LOOP
    UPDATE products
    SET stock_quantity = stock_quantity - complement.quantity,
        updated_at = NOW()
    WHERE id = complement.complement_product_id
      AND stock_quantity IS NOT NULL;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    IF rows_updated > 0 THEN
      reserved_products := reserved_products || jsonb_build_object(
        'productId', complement.complement_product_id,
        'quantity', complement.quantity,
        'type', 'complement'
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'insufficientItems', '[]'::jsonb,
    'reservedProducts', reserved_products
  );
END;
$$;

ALTER FUNCTION "public"."reserve_stock_for_order"(uuid) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."reserve_stock_for_order"(uuid) IS
'Atomically validates and reserves stock for an order. Uses row-level locking to prevent race conditions.
Returns {success: boolean, orderId: uuid, insufficientItems: array, reservedProducts: array}.
If success is false, no stock was decremented and insufficientItems contains the problematic products.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION "public"."reserve_stock_for_order"(uuid) TO anon;
GRANT EXECUTE ON FUNCTION "public"."reserve_stock_for_order"(uuid) TO authenticated;
