/*
  # Add Asaas Integration Support
  
  1. Changes
    - Add Asaas customer ID to clients table
    - Add Asaas subscription ID to loyalty_subscriptions table
    - Create subscription logs table for auditing
    
  2. Security
    - Maintain existing RLS policies
    - Add proper indexes
*/

-- Add Asaas fields to existing tables
ALTER TABLE clients
ADD COLUMN asaas_customer_id text;

ALTER TABLE loyalty_subscriptions
ADD COLUMN asaas_subscription_id text;

-- Create subscription logs table
CREATE TABLE loyalty_subscription_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id uuid REFERENCES loyalty_subscriptions(id) ON DELETE CASCADE,
  event text NOT NULL,
  payment_id text,
  payment_status text,
  raw_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE loyalty_subscription_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for subscription logs
CREATE POLICY "Admin can manage subscription logs"
  ON loyalty_subscription_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create indexes
CREATE INDEX idx_clients_asaas_customer_id ON clients(asaas_customer_id);
CREATE INDEX idx_loyalty_subscriptions_asaas_id ON loyalty_subscriptions(asaas_subscription_id);
CREATE INDEX idx_loyalty_subscription_logs_subscription_id ON loyalty_subscription_logs(subscription_id);