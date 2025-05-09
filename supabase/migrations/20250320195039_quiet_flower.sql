/*
  # Add Cash Register Functions
  
  1. Changes
    - Add functions for cash register calculations
    - Add function to close cash register
    - Add indexes for better performance
    
  2. Security
    - Maintain data integrity
    - Ensure proper calculations
*/

-- Create function to calculate daily cash register total
CREATE OR REPLACE FUNCTION calculate_daily_cash_register_total(closing_date date)
RETURNS decimal(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  total decimal(10,2);
BEGIN
  SELECT COALESCE(SUM(total_amount), 0)
  INTO total
  FROM transactions
  WHERE 
    DATE(created_at) = closing_date
    AND payment_status = 'completed'
    AND (
      is_monthly_billing = false
      OR (is_monthly_billing = true AND is_cash_register_closed = true)
    );
  
  RETURN total;
END;
$$;

-- Create function to calculate pending monthly billings
CREATE OR REPLACE FUNCTION calculate_pending_monthly_billings()
RETURNS decimal(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  total decimal(10,2);
BEGIN
  SELECT COALESCE(SUM(total_amount), 0)
  INTO total
  FROM transactions
  WHERE 
    is_monthly_billing = true
    AND payment_status = 'pending'
    AND is_cash_register_closed = false;
  
  RETURN total;
END;
$$;

-- Create function to close cash register
CREATE OR REPLACE FUNCTION close_cash_register(closing_date date)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update all transactions for the given date
  UPDATE transactions
  SET 
    is_cash_register_closed = true,
    cash_register_closing_date = NOW()
  WHERE 
    DATE(created_at) = closing_date
    AND (
      is_monthly_billing = false
      OR (is_monthly_billing = true AND payment_status = 'completed')
    );
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_monthly_billing ON transactions(is_monthly_billing) WHERE is_monthly_billing = true;