/*
  # Fix RLS Policies for Profiles and Services

  1. Changes
    - Update profiles table RLS policies to allow:
      - Public read access
      - Insert access for authenticated users
      - Update access for own profile
    
    - Update services table RLS policies to allow:
      - Public read access
      - Admin-only write access

  2. Security
    - Maintains data protection while fixing access issues
    - Ensures proper authentication checks
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Services are viewable by everyone" ON services;
DROP POLICY IF EXISTS "Admins can manage services" ON services;

-- Profiles policies
CREATE POLICY "Enable read access for all users"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on id"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Services policies
CREATE POLICY "Enable read access for all users"
  ON services FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for admin users"
  ON services FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Enable update for admin users"
  ON services FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Enable delete for admin users"
  ON services FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );