/*
  # Add Professional Support for Commission System
  
  1. Changes
    - Add professional_id column to order_items table
    - This allows for tracking which professional is credited with each service or product
    - Create foreign key relationship to profiles
    - Add index for better performance
    
  2. Security
    - Maintain data integrity through proper constraints
    - Preserve existing data and relationships
*/

-- Add professional_id column to order_items if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'professional_id'
  ) THEN
    ALTER TABLE order_items
    ADD COLUMN professional_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

    -- Create index for better performance
    CREATE INDEX idx_order_items_professional_id ON order_items(professional_id);

    -- Update existing items to use barber_id as professional_id
    UPDATE order_items oi
    SET professional_id = t.barber_id
    FROM transactions t
    WHERE oi.transaction_id = t.id
    AND oi.professional_id IS NULL
    AND t.barber_id IS NOT NULL;
  END IF;
END $$;

-- Create or update function to calculate commission with professional attribution
CREATE OR REPLACE FUNCTION calculate_commission(p_transaction_id uuid)
RETURNS decimal(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  total_commission decimal(10,2) := 0;
  v_barber_id uuid;
  service_item record;
  product_item record;
  v_service_rate decimal(5,2);
  v_product_rate decimal(5,2);
  v_professional_id uuid;
BEGIN
  -- Get transaction barber as a fallback
  SELECT barber_id INTO v_barber_id
  FROM transactions
  WHERE id = p_transaction_id;
  
  -- Calculate service commissions - per professional
  FOR service_item IN (
    SELECT 
      oi.total_price, 
      COALESCE(oi.professional_id, v_barber_id) as item_professional_id
    FROM order_items oi
    WHERE oi.transaction_id = p_transaction_id
    AND oi.service_id IS NOT NULL
  ) LOOP
    -- Get commission rate for this professional
    SELECT service_commission_rate INTO v_service_rate
    FROM profiles
    WHERE id = service_item.item_professional_id;
    
    -- Add to the total commission
    total_commission := total_commission + (service_item.total_price * COALESCE(v_service_rate, 50) / 100);
  END LOOP;

  -- Calculate product commissions - per professional
  FOR product_item IN (
    SELECT 
      oi.total_price, 
      COALESCE(oi.professional_id, v_barber_id) as item_professional_id
    FROM order_items oi
    WHERE oi.transaction_id = p_transaction_id
    AND oi.product_id IS NOT NULL
  ) LOOP
    -- Get commission rate for this professional
    SELECT product_commission_rate INTO v_product_rate
    FROM profiles
    WHERE id = product_item.item_professional_id;
    
    -- Add to the total commission
    total_commission := total_commission + (product_item.total_price * COALESCE(v_product_rate, 10) / 100);
  END LOOP;

  RETURN total_commission;
END;
$$;