/*
  # Add Stock Management Functions
  
  1. Changes
    - Add function to update product stock
    - Add trigger for stock updates
    - Add function to check stock alerts
*/

-- Create function to update product stock
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Decrease stock on new order
    UPDATE products
    SET stock_quantity = stock_quantity - NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Adjust stock on update
    UPDATE products
    SET stock_quantity = stock_quantity + OLD.quantity - NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Increase stock on deletion
    UPDATE products
    SET stock_quantity = stock_quantity + OLD.quantity
    WHERE id = OLD.product_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create separate triggers for each operation
DROP TRIGGER IF EXISTS update_product_stock_insert_trigger ON order_items;
CREATE TRIGGER update_product_stock_insert_trigger
  AFTER INSERT ON order_items
  FOR EACH ROW
  WHEN (NEW.product_id IS NOT NULL)
  EXECUTE FUNCTION update_product_stock();

DROP TRIGGER IF EXISTS update_product_stock_update_trigger ON order_items;
CREATE TRIGGER update_product_stock_update_trigger
  AFTER UPDATE ON order_items
  FOR EACH ROW
  WHEN (NEW.product_id IS NOT NULL OR OLD.product_id IS NOT NULL)
  EXECUTE FUNCTION update_product_stock();

DROP TRIGGER IF EXISTS update_product_stock_delete_trigger ON order_items;
CREATE TRIGGER update_product_stock_delete_trigger
  AFTER DELETE ON order_items
  FOR EACH ROW
  WHEN (OLD.product_id IS NOT NULL)
  EXECUTE FUNCTION update_product_stock();

-- Create function to check stock alerts
CREATE OR REPLACE FUNCTION check_low_stock_products()
RETURNS TABLE (
  product_id uuid,
  product_name text,
  current_stock integer,
  min_stock integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.stock_quantity,
    p.min_stock_alert
  FROM products p
  WHERE p.stock_quantity <= p.min_stock_alert
  AND p.active = true;
END;
$$;