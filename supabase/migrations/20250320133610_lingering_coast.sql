/*
  # Add Order Total Calculation Function
  
  1. Changes
    - Add function to calculate order total
    - Add function to update transaction total
    - Add trigger to auto-update totals
*/

-- Create function to calculate order total
CREATE OR REPLACE FUNCTION calculate_order_total(order_id uuid)
RETURNS decimal(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  total decimal(10,2);
BEGIN
  SELECT COALESCE(SUM(total_price), 0)
  INTO total
  FROM order_items
  WHERE transaction_id = order_id;
  
  RETURN total;
END;
$$;

-- Create function to update transaction total
CREATE OR REPLACE FUNCTION update_transaction_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the transaction total
  UPDATE transactions
  SET total_amount = calculate_order_total(NEW.transaction_id)
  WHERE id = NEW.transaction_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update transaction total
DROP TRIGGER IF EXISTS update_transaction_total_trigger ON order_items;
CREATE TRIGGER update_transaction_total_trigger
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_total();