/*
  # Add Loyalty Service Tracking to Order Items
  
  1. Changes
    - Add support for tracking loyalty subscription usage in order_items
    - Add subscription_id and is_loyalty_service columns to order_items table
    - Create indexes for better performance
    
  2. Security
    - Maintain data integrity
    - Preserve existing relationships
*/

-- Add columns to order_items table
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS subscription_id uuid,
ADD COLUMN IF NOT EXISTS is_loyalty_service boolean DEFAULT false;

-- Add foreign key constraint
ALTER TABLE order_items
ADD CONSTRAINT order_items_subscription_id_fkey
FOREIGN KEY (subscription_id)
REFERENCES loyalty_subscriptions(id)
ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_order_items_subscription_id ON order_items(subscription_id);
CREATE INDEX IF NOT EXISTS idx_order_items_is_loyalty_service ON order_items(is_loyalty_service) 
WHERE is_loyalty_service = true;