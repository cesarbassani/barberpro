/*
  # Fix Asaas Logs Policies

  1. Changes
    - Update RLS policies for asaas_logs table
    - Allow service role to insert logs
    - Allow admin to view logs
    
  2. Security
    - Maintain proper access control
    - Ensure logging works correctly
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can view logs" ON public.asaas_logs;
DROP POLICY IF EXISTS "Service role can insert logs" ON public.asaas_logs;
DROP POLICY IF EXISTS "Admin can manage subscription logs" ON public.asaas_logs;

-- Create new policies
CREATE POLICY "Admin can manage logs"
  ON public.asaas_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can insert logs"
  ON public.asaas_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_asaas_logs_action ON asaas_logs(action);
CREATE INDEX IF NOT EXISTS idx_asaas_logs_success ON asaas_logs(success);
CREATE INDEX IF NOT EXISTS idx_asaas_logs_created_at ON asaas_logs(created_at);