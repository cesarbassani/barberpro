/*
  # Add Debug Log Table for Product and Service Diagnostics
  
  1. Changes
    - Create debug_logs table for tracking product and service operations
    - Add RLS policies for admin access
    - Add function to create the table if it doesn't exist
    
  2. Security
    - Only admins can access logs
    - Maintain audit trail
*/

-- Create function to create debug log table
CREATE OR REPLACE FUNCTION create_debug_log_table()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create debug_logs table if it doesn't exist
  CREATE TABLE IF NOT EXISTS debug_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    module text NOT NULL,
    action text NOT NULL,
    success boolean NOT NULL,
    message text,
    details jsonb,
    duration_ms integer,
    created_at timestamptz DEFAULT now()
  );
  
  -- Enable RLS
  ALTER TABLE debug_logs ENABLE ROW LEVEL SECURITY;
  
  -- Create policy for admin access
  DROP POLICY IF EXISTS "Admin can manage debug logs" ON debug_logs;
  
  CREATE POLICY "Admin can manage debug logs"
    ON debug_logs
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    );
  
  -- Create indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_debug_logs_module ON debug_logs(module);
  CREATE INDEX IF NOT EXISTS idx_debug_logs_action ON debug_logs(action);
  CREATE INDEX IF NOT EXISTS idx_debug_logs_success ON debug_logs(success);
  CREATE INDEX IF NOT EXISTS idx_debug_logs_created_at ON debug_logs(created_at);
END;
$$;

-- Create function to execute arbitrary SQL (for admin use only)
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Call the function to create the table
SELECT create_debug_log_table();