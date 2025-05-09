/*
  # Fix Appointments Foreign Key Constraints

  1. Changes
    - Drop existing foreign key constraints
    - Create new constraints with correct references
    - Update RLS policies to match new schema
    
  2. Security
    - Maintain data integrity
    - Ensure proper references
*/

-- Drop existing foreign key constraints
ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS appointments_client_id_fkey,
DROP CONSTRAINT IF EXISTS appointments_barber_id_fkey;

-- Add new foreign key constraints
ALTER TABLE appointments
ADD CONSTRAINT appointments_client_id_fkey 
  FOREIGN KEY (client_id) 
  REFERENCES clients(id) 
  ON DELETE CASCADE,
ADD CONSTRAINT appointments_barber_id_fkey 
  FOREIGN KEY (barber_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for appointments" ON appointments;
DROP POLICY IF EXISTS "Enable insert for appointments" ON appointments;
DROP POLICY IF EXISTS "Enable update for appointments" ON appointments;
DROP POLICY IF EXISTS "Enable delete for appointments" ON appointments;

-- Create new policies with updated references
CREATE POLICY "Enable read access for appointments"
  ON appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = appointments.client_id
    ) OR
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
    auth.uid() = barber_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
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
    auth.uid() = barber_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );