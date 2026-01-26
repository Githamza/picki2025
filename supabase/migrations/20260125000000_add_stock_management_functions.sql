-- Stock Management RPC Functions
-- This migration adds functions for validating and managing product stock when orders are placed

-- ============================================================================
-- 1. VALIDATE STOCK FOR CART
-- Called before checkout to ensure all products have sufficient stock
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."validate_stock_for_cart"(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item jsonb;
  option_product jsonb;
  product_id integer;
  required_qty integer;
  current_stock integer;
  product_name text;
  insufficient_items jsonb := '[]'::jsonb;
  checked_products integer[] := '{}';
BEGIN
  -- Iterate through each cart item
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    product_id := (item->>'productId')::integer;
    required_qty := COALESCE((item->>'quantity')::integer, 1);

    -- Check main product stock
    IF product_id IS NOT NULL AND product_id > 0 AND NOT (product_id = ANY(checked_products)) THEN
      SELECT p.stock_quantity, p.name INTO current_stock, product_name
      FROM products p
      WHERE p.id = product_id;

      -- Only validate if stock is managed (not NULL)
      IF current_stock IS NOT NULL AND current_stock < required_qty THEN
        insufficient_items := insufficient_items || jsonb_build_object(
          'productId', product_id,
          'productName', product_name,
          'required', required_qty,
          'available', current_stock
        );
      END IF;

      checked_products := array_append(checked_products, product_id);
    END IF;

    -- Check multi-step option products (optionProductIds array)
    IF item ? 'optionProductIds' THEN
      FOR option_product IN SELECT * FROM jsonb_array_elements(item->'optionProductIds')
      LOOP
        product_id := option_product::integer;

        IF product_id IS NOT NULL AND product_id > 0 AND NOT (product_id = ANY(checked_products)) THEN
          SELECT p.stock_quantity, p.name INTO current_stock, product_name
          FROM products p
          WHERE p.id = product_id;

          IF current_stock IS NOT NULL AND current_stock < required_qty THEN
            insufficient_items := insufficient_items || jsonb_build_object(
              'productId', product_id,
              'productName', product_name,
              'required', required_qty,
              'available', current_stock
            );
          END IF;

          checked_products := array_append(checked_products, product_id);
        END IF;
      END LOOP;
    END IF;

    -- Check complement products (complementProductIds array)
    IF item ? 'complementProductIds' THEN
      FOR option_product IN SELECT * FROM jsonb_array_elements(item->'complementProductIds')
      LOOP
        product_id := (option_product->>'productId')::integer;
        required_qty := COALESCE((option_product->>'quantity')::integer, 1);

        IF product_id IS NOT NULL AND product_id > 0 AND NOT (product_id = ANY(checked_products)) THEN
          SELECT p.stock_quantity, p.name INTO current_stock, product_name
          FROM products p
          WHERE p.id = product_id;

          IF current_stock IS NOT NULL AND current_stock < required_qty THEN
            insufficient_items := insufficient_items || jsonb_build_object(
              'productId', product_id,
              'productName', product_name,
              'required', required_qty,
              'available', current_stock
            );
          END IF;

          checked_products := array_append(checked_products, product_id);
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'valid', jsonb_array_length(insufficient_items) = 0,
    'insufficientItems', insufficient_items
  );
END;
$$;

ALTER FUNCTION "public"."validate_stock_for_cart"(jsonb) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."validate_stock_for_cart"(jsonb) IS 'Validates that all products in a cart have sufficient stock. Returns {valid: boolean, insufficientItems: array}';

-- ============================================================================
-- 2. DECREMENT STOCK FOR ORDER
-- Called after order is created to reduce stock quantities
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."decrement_stock_for_order"(p_order_id uuid)
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
  product_id_to_decrement integer;
  decremented_products jsonb := '[]'::jsonb;
  rows_updated integer;
BEGIN
  -- 1. Decrement stock for main products in order_items
  FOR item IN
    SELECT oi.id, oi.product_id, oi.quantity, oi.options
    FROM order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.product_id IS NOT NULL
  LOOP
    -- Decrement main product stock (only if stock is managed and sufficient)
    UPDATE products
    SET stock_quantity = stock_quantity - item.quantity,
        updated_at = NOW()
    WHERE id = item.product_id
      AND stock_quantity IS NOT NULL;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    IF rows_updated > 0 THEN
      decremented_products := decremented_products || jsonb_build_object(
        'productId', item.product_id,
        'quantity', item.quantity,
        'type', 'main'
      );
    END IF;

    -- 2. Parse options JSONB for multi-step product references
    -- Structure: options[0].stepSelections[].selectedOptions[].productId
    IF item.options IS NOT NULL AND jsonb_typeof(item.options) = 'array' AND jsonb_array_length(item.options) > 0 THEN
      option_data := item.options->0;

      IF option_data ? 'stepSelections' THEN
        FOR step_selection IN SELECT * FROM jsonb_array_elements(option_data->'stepSelections')
        LOOP
          IF step_selection ? 'selectedOptions' THEN
            FOR selected_option IN SELECT * FROM jsonb_array_elements(step_selection->'selectedOptions')
            LOOP
              product_id_to_decrement := (selected_option->>'productId')::integer;

              IF product_id_to_decrement IS NOT NULL AND product_id_to_decrement > 0 THEN
                UPDATE products
                SET stock_quantity = stock_quantity - item.quantity,
                    updated_at = NOW()
                WHERE id = product_id_to_decrement
                  AND stock_quantity IS NOT NULL;

                GET DIAGNOSTICS rows_updated = ROW_COUNT;
                IF rows_updated > 0 THEN
                  decremented_products := decremented_products || jsonb_build_object(
                    'productId', product_id_to_decrement,
                    'quantity', item.quantity,
                    'type', 'multi_step_option'
                  );
                END IF;
              END IF;
            END LOOP;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  -- 3. Decrement stock for order item complements
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
      decremented_products := decremented_products || jsonb_build_object(
        'productId', complement.complement_product_id,
        'quantity', complement.quantity,
        'type', 'complement'
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'decrementedProducts', decremented_products
  );
END;
$$;

ALTER FUNCTION "public"."decrement_stock_for_order"(uuid) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."decrement_stock_for_order"(uuid) IS 'Decrements stock for all products in an order, including multi-step options and complements';

-- ============================================================================
-- 3. RESTORE STOCK FOR ORDER
-- Called when an order is cancelled or refused to restore stock quantities
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."restore_stock_for_order"(p_order_id uuid)
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
  product_id_to_restore integer;
  restored_products jsonb := '[]'::jsonb;
  rows_updated integer;
BEGIN
  -- 1. Restore stock for main products in order_items
  FOR item IN
    SELECT oi.id, oi.product_id, oi.quantity, oi.options
    FROM order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.product_id IS NOT NULL
  LOOP
    -- Restore main product stock (only if stock is managed)
    UPDATE products
    SET stock_quantity = stock_quantity + item.quantity,
        updated_at = NOW()
    WHERE id = item.product_id
      AND stock_quantity IS NOT NULL;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    IF rows_updated > 0 THEN
      restored_products := restored_products || jsonb_build_object(
        'productId', item.product_id,
        'quantity', item.quantity,
        'type', 'main'
      );
    END IF;

    -- 2. Parse options JSONB for multi-step product references
    IF item.options IS NOT NULL AND jsonb_typeof(item.options) = 'array' AND jsonb_array_length(item.options) > 0 THEN
      option_data := item.options->0;

      IF option_data ? 'stepSelections' THEN
        FOR step_selection IN SELECT * FROM jsonb_array_elements(option_data->'stepSelections')
        LOOP
          IF step_selection ? 'selectedOptions' THEN
            FOR selected_option IN SELECT * FROM jsonb_array_elements(step_selection->'selectedOptions')
            LOOP
              product_id_to_restore := (selected_option->>'productId')::integer;

              IF product_id_to_restore IS NOT NULL AND product_id_to_restore > 0 THEN
                UPDATE products
                SET stock_quantity = stock_quantity + item.quantity,
                    updated_at = NOW()
                WHERE id = product_id_to_restore
                  AND stock_quantity IS NOT NULL;

                GET DIAGNOSTICS rows_updated = ROW_COUNT;
                IF rows_updated > 0 THEN
                  restored_products := restored_products || jsonb_build_object(
                    'productId', product_id_to_restore,
                    'quantity', item.quantity,
                    'type', 'multi_step_option'
                  );
                END IF;
              END IF;
            END LOOP;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  -- 3. Restore stock for order item complements
  FOR complement IN
    SELECT oic.complement_product_id, oic.quantity
    FROM order_item_complements oic
    JOIN order_items oi ON oi.id = oic.order_item_id
    WHERE oi.order_id = p_order_id
      AND oic.complement_product_id IS NOT NULL
  LOOP
    UPDATE products
    SET stock_quantity = stock_quantity + complement.quantity,
        updated_at = NOW()
    WHERE id = complement.complement_product_id
      AND stock_quantity IS NOT NULL;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    IF rows_updated > 0 THEN
      restored_products := restored_products || jsonb_build_object(
        'productId', complement.complement_product_id,
        'quantity', complement.quantity,
        'type', 'complement'
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'restoredProducts', restored_products
  );
END;
$$;

ALTER FUNCTION "public"."restore_stock_for_order"(uuid) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."restore_stock_for_order"(uuid) IS 'Restores stock for all products in an order when it is cancelled or refused';

-- Grant execute permissions to authenticated and anon users
GRANT EXECUTE ON FUNCTION "public"."validate_stock_for_cart"(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION "public"."validate_stock_for_cart"(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."decrement_stock_for_order"(uuid) TO anon;
GRANT EXECUTE ON FUNCTION "public"."decrement_stock_for_order"(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."restore_stock_for_order"(uuid) TO anon;
GRANT EXECUTE ON FUNCTION "public"."restore_stock_for_order"(uuid) TO authenticated;
