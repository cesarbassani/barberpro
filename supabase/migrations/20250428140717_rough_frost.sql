/*
  # Add Asaas Logs Table
  
  1. Changes
    - Create asaas_logs table for tracking API calls
    - Add RLS policies for admin access
    - Add indexes for better performance
    
  2. Security
    - Only admins can access logs
    - Maintain audit trail
*/

-- Create asaas_logs table
CREATE TABLE asaas_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  action text NOT NULL,
  payload jsonb,
  response jsonb,
  success boolean NOT NULL,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE asaas_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admin can view logs"
  ON asaas_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_asaas_logs_action ON asaas_logs(action);
CREATE INDEX idx_asaas_logs_success ON asaas_logs(success);
CREATE INDEX idx_asaas_logs_created_at ON asaas_logs(created_at);