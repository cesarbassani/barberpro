/*
  # Add Commission Rates to Profiles

  1. Changes
    - Add service_commission_rate column to profiles table
    - Add product_commission_rate column to profiles table
    - Set default values for commission rates
    - Add check constraints for valid percentages

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity with constraints
*/

-- Add commission rate columns to profiles table
ALTER TABLE profiles
ADD COLUMN service_commission_rate decimal(5,2) DEFAULT 0.00,
ADD COLUMN product_commission_rate decimal(5,2) DEFAULT 0.00;

-- Add check constraints to ensure valid percentage values (0-100)
ALTER TABLE profiles
ADD CONSTRAINT service_commission_rate_check 
CHECK (service_commission_rate >= 0 AND service_commission_rate <= 100),
ADD CONSTRAINT product_commission_rate_check 
CHECK (product_commission_rate >= 0 AND product_commission_rate <= 100);

-- Update existing barber profiles to have default commission rates
UPDATE profiles 
SET 
  service_commission_rate = 50.00,
  product_commission_rate = 10.00
WHERE role = 'barber';