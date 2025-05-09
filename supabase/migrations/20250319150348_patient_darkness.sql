/*
  # Fix Services Table RLS Policies

  1. Changes
    - Safely drop and recreate services policies
    - Ensure proper admin access control
    - Maintain public read access

  2. Security
    - Implement proper role-based access
    - Ensure data protection
*/

DO $$ 
BEGIN
    -- Drop all existing policies for services table
    DROP POLICY IF EXISTS "Public read access for services" ON services;
    DROP POLICY IF EXISTS "Admin manage services" ON services;
    DROP POLICY IF EXISTS "Admin insert access for services" ON services;
    DROP POLICY IF EXISTS "Admin update access for services" ON services;
    DROP POLICY IF EXISTS "Admin delete access for services" ON services;
    
    -- Create new policies with unique names
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
END $$;