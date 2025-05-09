/*
  # Add Recurring Flag to Loyalty Subscriptions
  
  1. Changes
    - Add is_recurring column to loyalty_subscriptions table
    - Set default value to false
    - Add description for recurring subscriptions
    
  2. Security
    - Maintain existing RLS policies
    - Preserve data integrity
*/

-- Add is_recurring column to loyalty_subscriptions table
ALTER TABLE loyalty_subscriptions
ADD COLUMN is_recurring boolean DEFAULT false;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_loyalty_subscriptions_recurring 
ON loyalty_subscriptions(is_recurring) 
WHERE is_recurring = true;