/*
  # Fix Services Table RLS Policies

  1. Changes
    - Drop and recreate services table RLS policies
    - Simplify policies to ensure proper access
    - Fix column selection issue

  2. Security
    - Maintain proper access control
    - Ensure public read access works correctly
*/

-- Drop existing policies for services
DROP POLICY IF EXISTS "Enable read access for all users" ON services;
DROP POLICY IF EXISTS "Enable insert for admin users" ON services;
DROP POLICY IF EXISTS "Enable update for admin users" ON services;
DROP POLICY IF EXISTS "Enable delete for admin users" ON services;

-- Recreate services policies with simplified conditions
CREATE POLICY "Public read access for services"
  ON services FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admin insert access for services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin update access for services"
  ON services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin delete access for services"
  ON services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );