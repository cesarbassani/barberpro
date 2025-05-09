/*
  # Add Cash Register and Monthly Billing Support

  1. Changes
    - Add monthly billing flag to transactions
    - Add cash register closing date
    - Add cash register closing status
    - Create functions for cash calculations
    
  2. Security
    - Maintain proper access control
    - Ensure data integrity
*/

-- Add monthly billing and cash register columns to transactions
ALTER TABLE transactions
ADD COLUMN is_monthly_billing boolean DEFAULT false,
ADD COLUMN cash_register_closing_date timestamptz,
ADD COLUMN is_cash_register_closed boolean DEFAULT false;

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