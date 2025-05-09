/*
  # Fix Appointments RLS Policies

  1. Changes
    - Drop existing appointments RLS policies
    - Create new policies that allow:
      - Clients to create appointments for themselves
      - Barbers to manage their own appointments
      - Admins to manage all appointments
    
  2. Security
    - Maintain proper access control
    - Ensure data integrity
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Clients can create appointments" ON appointments;
DROP POLICY IF EXISTS "Users can update own appointments" ON appointments;

-- Create new policies
CREATE POLICY "Enable read access for appointments"
  ON appointments FOR SELECT
  USING (
    auth.uid() = client_id OR
    auth.uid() = barber_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Enable insert for appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Clients can only create appointments for themselves
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'client'
      )
      AND auth.uid() = client_id
    )
    OR
    -- Barbers can create appointments for their clients
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'barber'
      )
      AND auth.uid() = barber_id
    )
    OR
    -- Admins can create appointments for anyone
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Enable update for appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = client_id OR
    auth.uid() = barber_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = client_id OR
    auth.uid() = barber_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Enable delete for appointments"
  ON appointments FOR DELETE
  TO authenticated
  USING (
    auth.uid() = client_id OR
    auth.uid() = barber_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );