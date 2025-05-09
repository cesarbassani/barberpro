/*
  # Fix Asaas Logs Table
  
  1. Changes
    - Add elapsed_time_ms column to asaas_logs table
    - This column is needed for performance tracking
    
  2. Security
    - Maintains existing permissions
    - No security impact
*/

-- Add elapsed_time_ms column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'asaas_logs' 
    AND column_name = 'elapsed_time_ms'
  ) THEN
    ALTER TABLE asaas_logs
    ADD COLUMN elapsed_time_ms integer;
  END IF;
END $$;