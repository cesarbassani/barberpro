/*
  # Update asaas_logs RLS policies

  1. Security Changes
    - Add RLS policy to allow service role to insert logs
    - Add RLS policy to allow admins to view logs
*/

-- Update RLS policies for asaas_logs
DROP POLICY IF EXISTS "Admin can view logs" ON public.asaas_logs;
DROP POLICY IF EXISTS "Service role can insert logs" ON public.asaas_logs;

CREATE POLICY "Admin can view logs"
  ON public.asaas_logs
  FOR SELECT
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
  TO authenticated
  WITH CHECK (true);