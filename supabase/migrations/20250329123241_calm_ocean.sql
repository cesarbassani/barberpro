/*
  # Fix Service Categories Relationship
  
  1. Changes
    - Drop and recreate foreign key constraint
    - Update services table schema
    - Fix RLS policies
    
  2. Security
    - Maintain proper access control
    - Ensure data integrity
*/

-- Drop existing foreign key constraint if it exists
ALTER TABLE services
DROP CONSTRAINT IF EXISTS services_category_id_fkey;

-- Add foreign key constraint with proper name and definition
ALTER TABLE services
ADD CONSTRAINT services_category_id_fkey
FOREIGN KEY (category_id)
REFERENCES service_categories(id);

-- Create index for better performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_services_category_id ON services(category_id);

-- Drop existing policies
DROP POLICY IF EXISTS "services_public_read_access_v2" ON services;
DROP POLICY IF EXISTS "services_admin_insert_v2" ON services;
DROP POLICY IF EXISTS "services_admin_update_v2" ON services;
DROP POLICY IF EXISTS "services_admin_delete_v2" ON services;

-- Create new policies with proper joins
CREATE POLICY "services_public_read_access_v2"
  ON services FOR SELECT
  USING (true);

CREATE POLICY "services_admin_insert_v2"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "services_admin_update_v2"
  ON services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "services_admin_delete_v2"
  ON services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );