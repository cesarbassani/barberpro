/*
  # Inventory Management System
  
  1. New Tables and Columns
    - Add batch tracking to products
    - Create inventory_transactions table for stock movement history
    - Add inventory_adjustments for manual stock updates
    - Create quality_control table for tracking product quality

  2. New Functions
    - Track inventory movements
    - Validate stock availability
    - Generate inventory reports
    
  3. Security
    - RLS policies for all new tables
    - Transaction-based stock updates
*/

-- Add batch tracking fields to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS sku text,
ADD COLUMN IF NOT EXISTS cost_price decimal(10,2),
ADD COLUMN IF NOT EXISTS last_restock_date timestamptz,
ADD COLUMN IF NOT EXISTS reorder_point integer DEFAULT 10;

-- Create inventory transactions table for stock movement
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  transaction_type text NOT NULL CHECK (
    transaction_type IN ('purchase', 'sale', 'adjustment', 'return', 'transfer', 'loss')
  ),
  quantity integer NOT NULL,
  previous_quantity integer NOT NULL,
  new_quantity integer NOT NULL,
  reference_id uuid, -- Can reference any transaction ID
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Create inventory adjustments table
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity integer NOT NULL,
  reason_code text NOT NULL CHECK (
    reason_code IN ('damaged', 'expired', 'lost', 'found', 'correction', 'other')
  ),
  notes text,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  transaction_id uuid REFERENCES inventory_transactions(id),
  created_at timestamptz DEFAULT now()
);

-- Create product batches table
CREATE TABLE IF NOT EXISTS product_batches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  batch_number text NOT NULL,
  quantity integer NOT NULL,
  expiration_date date,
  manufacturing_date date,
  purchase_date date,
  cost_price decimal(10,2),
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quality control table
CREATE TABLE IF NOT EXISTS quality_control (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  batch_id uuid REFERENCES product_batches(id),
  status text NOT NULL CHECK (
    status IN ('passed', 'failed', 'pending')
  ),
  inspection_date timestamptz DEFAULT now(),
  inspector_id uuid REFERENCES profiles(id) NOT NULL,
  notes text,
  action_taken text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create returned items table
CREATE TABLE IF NOT EXISTS returned_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  transaction_id uuid REFERENCES transactions(id),
  quantity integer NOT NULL,
  reason text NOT NULL,
  condition text CHECK (
    condition IN ('damaged', 'unopened', 'expired', 'wrong_item', 'other')
  ),
  action_taken text CHECK (
    action_taken IN ('refund', 'exchange', 'return_to_stock', 'discard', 'other')
  ),
  returned_to_stock boolean DEFAULT false,
  notes text,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add triggers for updated_at
CREATE TRIGGER update_product_batches_updated_at
  BEFORE UPDATE ON product_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quality_control_updated_at
  BEFORE UPDATE ON quality_control
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_returned_items_updated_at
  BEFORE UPDATE ON returned_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE returned_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admin can manage inventory_transactions"
  ON inventory_transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can manage inventory_adjustments"
  ON inventory_adjustments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can manage product_batches"
  ON product_batches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can manage quality_control"
  ON quality_control FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can manage returned_items"
  ON returned_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Public read access
CREATE POLICY "Public can view inventory_transactions"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public can view product_batches"
  ON product_batches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public can view quality_control"
  ON quality_control FOR SELECT
  TO authenticated
  USING (true);

-- Function to record inventory transaction
CREATE OR REPLACE FUNCTION record_inventory_transaction(
  p_product_id uuid,
  p_transaction_type text,
  p_quantity integer,
  p_reference_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_previous_quantity integer;
  v_new_quantity integer;
  v_transaction_id uuid;
BEGIN
  -- Get current stock quantity
  SELECT stock_quantity INTO v_previous_quantity
  FROM products
  WHERE id = p_product_id;
  
  -- Calculate new quantity based on transaction type
  IF p_transaction_type IN ('purchase', 'return', 'adjustment') THEN
    v_new_quantity := v_previous_quantity + p_quantity;
  ELSIF p_transaction_type IN ('sale', 'loss', 'transfer') THEN
    v_new_quantity := v_previous_quantity - p_quantity;
  ELSE
    RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
  END IF;
  
  -- Update product stock
  UPDATE products
  SET 
    stock_quantity = v_new_quantity,
    updated_at = now()
  WHERE id = p_product_id;
  
  -- Record transaction
  INSERT INTO inventory_transactions (
    product_id,
    transaction_type,
    quantity,
    previous_quantity,
    new_quantity,
    reference_id,
    notes,
    created_by
  )
  VALUES (
    p_product_id,
    p_transaction_type,
    p_quantity,
    v_previous_quantity,
    v_new_quantity,
    p_reference_id,
    p_notes,
    auth.uid()
  )
  RETURNING id INTO v_transaction_id;
  
  -- Update last_restock_date if this is a purchase
  IF p_transaction_type = 'purchase' THEN
    UPDATE products
    SET last_restock_date = now()
    WHERE id = p_product_id;
  END IF;
  
  RETURN v_transaction_id;
END;
$$;

-- Function to check if stock is available
CREATE OR REPLACE FUNCTION is_stock_available(
  p_product_id uuid,
  p_quantity integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_available_stock integer;
BEGIN
  SELECT stock_quantity INTO v_available_stock
  FROM products
  WHERE id = p_product_id;
  
  RETURN v_available_stock >= p_quantity;
END;
$$;

-- Function to get products below reorder point
CREATE OR REPLACE FUNCTION get_products_below_reorder_point()
RETURNS TABLE (
  product_id uuid,
  product_name text,
  current_stock integer,
  reorder_point integer,
  last_restock_date timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.stock_quantity,
    p.reorder_point,
    p.last_restock_date
  FROM products p
  WHERE p.stock_quantity <= p.reorder_point
  AND p.active = true
  ORDER BY (p.stock_quantity::float / NULLIF(p.reorder_point, 0)) ASC;
END;
$$;

-- Function to calculate inventory value
CREATE OR REPLACE FUNCTION calculate_inventory_value()
RETURNS decimal(14,2)
LANGUAGE plpgsql
AS $$
DECLARE
  total_value decimal(14,2);
BEGIN
  SELECT COALESCE(SUM(p.stock_quantity * COALESCE(p.cost_price, p.price * 0.6)), 0)
  INTO total_value
  FROM products p
  WHERE p.active = true;
  
  RETURN total_value;
END;
$$;

-- Function to calculate inventory turnover
CREATE OR REPLACE FUNCTION calculate_inventory_turnover(
  start_date timestamptz,
  end_date timestamptz
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  beginning_inventory integer,
  ending_inventory integer,
  sales_quantity integer,
  turnover_rate numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH sales AS (
    SELECT 
      it.product_id,
      SUM(it.quantity) as total_sales
    FROM inventory_transactions it
    WHERE it.transaction_type = 'sale'
      AND it.created_at BETWEEN start_date AND end_date
    GROUP BY it.product_id
  ),
  inventory_start AS (
    SELECT 
      p.id as product_id,
      COALESCE((
        SELECT it.new_quantity 
        FROM inventory_transactions it
        WHERE it.product_id = p.id
          AND it.created_at < start_date
        ORDER BY it.created_at DESC
        LIMIT 1
      ), p.stock_quantity) as beginning_quantity
    FROM products p
  ),
  inventory_end AS (
    SELECT 
      p.id as product_id,
      COALESCE((
        SELECT it.new_quantity 
        FROM inventory_transactions it
        WHERE it.product_id = p.id
          AND it.created_at <= end_date
        ORDER BY it.created_at DESC
        LIMIT 1
      ), p.stock_quantity) as ending_quantity
    FROM products p
  )
  SELECT 
    p.id as product_id,
    p.name as product_name,
    is_start.beginning_quantity as beginning_inventory,
    is_end.ending_quantity as ending_inventory,
    COALESCE(s.total_sales, 0) as sales_quantity,
    CASE 
      WHEN (is_start.beginning_quantity + is_end.ending_quantity) / 2 = 0 THEN 0
      ELSE COALESCE(s.total_sales, 0)::numeric / NULLIF(((is_start.beginning_quantity + is_end.ending_quantity) / 2), 0)
    END as turnover_rate
  FROM products p
  JOIN inventory_start is_start ON p.id = is_start.product_id
  JOIN inventory_end is_end ON p.id = is_end.product_id
  LEFT JOIN sales s ON p.id = s.product_id
  WHERE p.active = true
  ORDER BY turnover_rate DESC;
END;
$$;

-- Create indexes for better performance
CREATE INDEX idx_inventory_transactions_product_id ON inventory_transactions(product_id);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_inventory_transactions_created_at ON inventory_transactions(created_at);
CREATE INDEX idx_inventory_adjustments_product_id ON inventory_adjustments(product_id);
CREATE INDEX idx_product_batches_product_id ON product_batches(product_id);
CREATE INDEX idx_product_batches_expiration ON product_batches(expiration_date);
CREATE INDEX idx_product_batches_batch_number ON product_batches(batch_number);
CREATE INDEX idx_quality_control_product_id ON quality_control(product_id);
CREATE INDEX idx_quality_control_status ON quality_control(status);
CREATE INDEX idx_returned_items_product_id ON returned_items(product_id);
CREATE INDEX idx_returned_items_condition ON returned_items(condition);

-- Add notification settings for inventory alerts
INSERT INTO settings (key, value)
VALUES (
  'inventory_settings',
  jsonb_build_object(
    'lowStockNotificationsEnabled', true,
    'expiryDateNotificationsEnabled', true,
    'daysBeforeExpiryAlert', 30,
    'inventoryCountFrequency', 'monthly',
    'autoReorderEnabled', false,
    'defaultReorderQuantity', 'min_stock_alert * 2'
  )
) ON CONFLICT (key) DO NOTHING;