/*
  # Add Client Email and Visit Tracking
  
  1. Changes
    - Add email field to clients table
    - Add visit counter
    - Add last visit date
    - Update RLS policies
    
  2. Security
    - Maintain data integrity
    - Preserve existing data
*/

-- Add new columns to clients table
ALTER TABLE clients
ADD COLUMN email text,
ADD COLUMN visit_count integer DEFAULT 0,
ADD COLUMN last_visit_date timestamptz;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- Create function to update visit tracking
CREATE OR REPLACE FUNCTION update_client_visit()
RETURNS TRIGGER AS $$
BEGIN
  -- Update visit count and last visit date
  UPDATE clients
  SET 
    visit_count = visit_count + 1,
    last_visit_date = NOW()
  WHERE id = NEW.client_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to track visits through appointments
DROP TRIGGER IF EXISTS track_client_visit_appointment ON appointments;
CREATE TRIGGER track_client_visit_appointment
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_client_visit();

-- Create trigger to track visits through transactions
DROP TRIGGER IF EXISTS track_client_visit_transaction ON transactions;
CREATE TRIGGER track_client_visit_transaction
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_client_visit();