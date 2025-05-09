/*
  # Add Payment Method to Loyalty Subscriptions
  
  1. Changes
    - Add payment_method column to loyalty_subscriptions table
    - Add Asaas payment method enum type
    - Add constraint for valid payment methods
*/

-- Create payment method type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE asaas_payment_method AS ENUM ('BOLETO', 'CREDIT_CARD', 'PIX');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add payment_method column to loyalty_subscriptions
ALTER TABLE loyalty_subscriptions
ADD COLUMN payment_method asaas_payment_method;