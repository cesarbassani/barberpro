/*
  # Add Order Status and Update Transaction Schema

  1. Changes
    - Add order_status enum type
    - Add order_items table for better item tracking
    - Update transaction schema with new fields
    - Add RLS policies for new tables

  2. Security
    - Ensure proper access control
    - Maintain data integrity
*/

-- Create order status enum
CREATE TYPE order_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');

-- Add status to transactions table
ALTER TABLE transactions
ADD COLUMN status order_status DEFAULT 'open';

-- Create order items table for better tracking
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id),
  product_id uuid REFERENCES products(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT order_items_service_or_product_check 
    CHECK (
      (service_id IS NOT NULL AND product_id IS NULL) OR 
      (service_id IS NULL AND product_id IS NOT NULL)
    )
);

-- Add trigger for updated_at
CREATE TRIGGER update_order_items_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for order_items
CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = order_items.transaction_id
      AND (
        transactions.client_id = auth.uid() OR
        transactions.barber_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Barbers and admins can manage order items"
  ON order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      JOIN profiles p ON p.id = auth.uid()
      WHERE t.id = order_items.transaction_id
      AND (
        (p.role = 'barber' AND t.barber_id = auth.uid()) OR
        p.role = 'admin'
      )
    )
  );