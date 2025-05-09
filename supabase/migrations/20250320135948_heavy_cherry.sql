/*
  # Fix Transaction Functions and Triggers
  
  1. Changes
    - Fix ambiguous column references in functions
    - Update trigger handling for order items
    - Ensure proper table aliases
    
  2. Security
    - Maintain existing security policies
    - Preserve data integrity
*/

-- First drop the triggers that depend on the functions
DROP TRIGGER IF EXISTS update_transaction_total_trigger ON order_items;
DROP TRIGGER IF EXISTS update_transaction_commission_trigger ON order_items;
DROP TRIGGER IF EXISTS update_product_stock_insert_trigger ON order_items;
DROP TRIGGER IF EXISTS update_product_stock_update_trigger ON order_items;
DROP TRIGGER IF EXISTS update_product_stock_delete_trigger ON order_items;

-- Now drop the functions
DROP FUNCTION IF EXISTS calculate_order_total(uuid);
DROP FUNCTION IF EXISTS update_transaction_total();
DROP FUNCTION IF EXISTS calculate_commission(uuid);
DROP FUNCTION IF EXISTS update_transaction_commission();
DROP FUNCTION IF EXISTS update_product_stock();

-- Create function to calculate order total
CREATE OR REPLACE FUNCTION calculate_order_total(p_transaction_id uuid)
RETURNS decimal(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  total decimal(10,2);
BEGIN
  SELECT COALESCE(SUM(oi.total_price), 0)
  INTO total
  FROM order_items oi
  WHERE oi.transaction_id = p_transaction_id;
  
  RETURN total;
END;
$$;

-- Create function to update transaction total
CREATE OR REPLACE FUNCTION update_transaction_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  trans_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    trans_id := OLD.transaction_id;
  ELSE
    trans_id := NEW.transaction_id;
  END IF;

  UPDATE transactions t
  SET total_amount = calculate_order_total(trans_id)
  WHERE t.id = trans_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create function to calculate commission
CREATE OR REPLACE FUNCTION calculate_commission(p_transaction_id uuid)
RETURNS decimal(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  total_commission decimal(10,2) := 0;
  v_barber_id uuid;
  v_service_rate decimal(5,2);
  v_product_rate decimal(5,2);
BEGIN
  -- Get barber and commission rates
  SELECT 
    t.barber_id,
    p.service_commission_rate,
    p.product_commission_rate
  INTO 
    v_barber_id,
    v_service_rate,
    v_product_rate
  FROM transactions t
  JOIN profiles p ON p.id = t.barber_id
  WHERE t.id = p_transaction_id;

  -- Calculate service commissions
  SELECT COALESCE(SUM((oi.total_price * v_service_rate) / 100), 0)
  INTO total_commission
  FROM order_items oi
  WHERE oi.transaction_id = p_transaction_id
  AND oi.service_id IS NOT NULL;

  -- Add product commissions
  SELECT total_commission + COALESCE(SUM((oi.total_price * v_product_rate) / 100), 0)
  INTO total_commission
  FROM order_items oi
  WHERE oi.transaction_id = p_transaction_id
  AND oi.product_id IS NOT NULL;

  RETURN total_commission;
END;
$$;

-- Create function to update transaction commission
CREATE OR REPLACE FUNCTION update_transaction_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  trans_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    trans_id := OLD.transaction_id;
  ELSE
    trans_id := NEW.transaction_id;
  END IF;

  UPDATE transactions t
  SET commission_amount = calculate_commission(trans_id)
  WHERE t.id = trans_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create function to update product stock
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Decrease stock on new order
    UPDATE products p
    SET stock_quantity = p.stock_quantity - NEW.quantity
    WHERE p.id = NEW.product_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Adjust stock on update
    UPDATE products p
    SET stock_quantity = p.stock_quantity + OLD.quantity - NEW.quantity
    WHERE p.id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Increase stock on deletion
    UPDATE products p
    SET stock_quantity = p.stock_quantity + OLD.quantity
    WHERE p.id = OLD.product_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate all triggers
CREATE TRIGGER update_transaction_total_trigger
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_total();

CREATE TRIGGER update_transaction_commission_trigger
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_commission();

CREATE TRIGGER update_product_stock_insert_trigger
  AFTER INSERT ON order_items
  FOR EACH ROW
  WHEN (NEW.product_id IS NOT NULL)
  EXECUTE FUNCTION update_product_stock();

CREATE TRIGGER update_product_stock_update_trigger
  AFTER UPDATE ON order_items
  FOR EACH ROW
  WHEN (NEW.product_id IS NOT NULL OR OLD.product_id IS NOT NULL)
  EXECUTE FUNCTION update_product_stock();

CREATE TRIGGER update_product_stock_delete_trigger
  AFTER DELETE ON order_items
  FOR EACH ROW
  WHEN (OLD.product_id IS NOT NULL)
  EXECUTE FUNCTION update_product_stock();