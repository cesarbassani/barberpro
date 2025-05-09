/*
  # Update Schema for Client Management and Cash Register

  1. Changes
    - Create separate clients table
    - Add cash register related fields to transactions
    - Add cash register functions
    - Update RLS policies

  2. Security
    - Maintain proper access control
    - Ensure data integrity
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name text NOT NULL,
  phone text,
  birth_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Create policies for clients
CREATE POLICY "Public read access for clients"
  ON clients FOR SELECT
  USING (true);

CREATE POLICY "Barbers and admins can manage clients"
  ON clients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'barber' OR profiles.role = 'admin')
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add cash register related fields to transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS is_monthly_billing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cash_register_closing_date timestamptz,
ADD COLUMN IF NOT EXISTS is_cash_register_closed boolean DEFAULT false;

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

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_clients_full_name ON clients(full_name);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_monthly_billing ON transactions(is_monthly_billing) WHERE is_monthly_billing = true;