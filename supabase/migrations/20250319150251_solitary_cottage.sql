/*
  # Fix Services Table RLS Policies

  1. Changes
    - Update services table RLS policies
    - Allow admin users to manage services
    - Ensure public read access

  2. Security
    - Maintain proper access control
    - Fix policy violations
*/

-- Drop existing policies for services
DROP POLICY IF EXISTS "Public read access for services" ON services;
DROP POLICY IF EXISTS "Admin insert access for services" ON services;
DROP POLICY IF EXISTS "Admin update access for services" ON services;
DROP POLICY IF EXISTS "Admin delete access for services" ON services;

-- Create new policies
CREATE POLICY "Public read access for services"
  ON services FOR SELECT
  USING (true);

CREATE POLICY "Admin manage services"
  ON services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );