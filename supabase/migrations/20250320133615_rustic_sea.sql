/*
  # Add Commission Calculation Functions
  
  1. Changes
    - Add function to calculate service commission
    - Add function to calculate product commission
    - Add function to update transaction commission
*/

-- Create function to calculate commission
CREATE OR REPLACE FUNCTION calculate_commission(transaction_id uuid)
RETURNS decimal(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  total_commission decimal(10,2) := 0;
  barber_id uuid;
  service_rate decimal(5,2);
  product_rate decimal(5,2);
BEGIN
  -- Get barber and commission rates
  SELECT 
    t.barber_id,
    p.service_commission_rate,
    p.product_commission_rate
  INTO 
    barber_id,
    service_rate,
    product_rate
  FROM transactions t
  JOIN profiles p ON p.id = t.barber_id
  WHERE t.id = transaction_id;

  -- Calculate service commissions
  SELECT COALESCE(SUM((oi.total_price * service_rate) / 100), 0)
  INTO total_commission
  FROM order_items oi
  WHERE oi.transaction_id = transaction_id
  AND oi.service_id IS NOT NULL;

  -- Add product commissions
  SELECT total_commission + COALESCE(SUM((oi.total_price * product_rate) / 100), 0)
  INTO total_commission
  FROM order_items oi
  WHERE oi.transaction_id = transaction_id
  AND oi.product_id IS NOT NULL;

  RETURN total_commission;
END;
$$;

-- Create function to update transaction commission
CREATE OR REPLACE FUNCTION update_transaction_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the transaction commission
  UPDATE transactions
  SET commission_amount = calculate_commission(NEW.transaction_id)
  WHERE id = NEW.transaction_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update transaction commission
DROP TRIGGER IF EXISTS update_transaction_commission_trigger ON order_items;
CREATE TRIGGER update_transaction_commission_trigger
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_commission();