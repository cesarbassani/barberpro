/*
  # RLS Policies Setup for BarberPro

  1. Changes
    - Drop existing policies to avoid conflicts
    - Create new policies for all tables
    - Set up proper access control based on user roles

  2. Security
    - Ensure proper data access control
    - Implement role-based security
    - Protect sensitive data
*/

-- Drop existing policies
DO $$ 
BEGIN
  -- Profiles policies
  DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
  DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;
  
  -- Services policies
  DROP POLICY IF EXISTS "Public read access for services" ON services;
  DROP POLICY IF EXISTS "Admin insert access for services" ON services;
  DROP POLICY IF EXISTS "Admin update access for services" ON services;
  DROP POLICY IF EXISTS "Admin delete access for services" ON services;
  
  -- Products policies
  DROP POLICY IF EXISTS "Public read access for products" ON products;
  DROP POLICY IF EXISTS "Admin insert access for products" ON products;
  DROP POLICY IF EXISTS "Admin update access for products" ON products;
  DROP POLICY IF EXISTS "Admin delete access for products" ON products;
  
  -- Appointments policies
  DROP POLICY IF EXISTS "Users can view own appointments" ON appointments;
  DROP POLICY IF EXISTS "Clients can create appointments" ON appointments;
  DROP POLICY IF EXISTS "Users can update own appointments" ON appointments;
  
  -- Transactions policies
  DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
  DROP POLICY IF EXISTS "Admin create transactions" ON transactions;
  DROP POLICY IF EXISTS "Admin update transactions" ON transactions;
  
  -- Transaction items policies
  DROP POLICY IF EXISTS "Users can view own transaction items" ON transaction_items;
  DROP POLICY IF EXISTS "Admin manage transaction items" ON transaction_items;
  
  -- Loyalty points policies
  DROP POLICY IF EXISTS "Users can view own loyalty points" ON loyalty_points;
  DROP POLICY IF EXISTS "Admin manage loyalty points" ON loyalty_points;
END $$;

-- Profiles policies
CREATE POLICY "Enable read access for all users"
  ON profiles FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on id"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Services policies
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

-- Products policies
CREATE POLICY "Public read access for products"
  ON products FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admin insert access for products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin update access for products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin delete access for products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Appointments policies
CREATE POLICY "Users can view own appointments"
  ON appointments FOR SELECT
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

CREATE POLICY "Clients can create appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Users can update own appointments"
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
  );

-- Transactions policies
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
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

CREATE POLICY "Admin create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin update transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Transaction items policies
CREATE POLICY "Users can view own transaction items"
  ON transaction_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_items.transaction_id
      AND (
        transactions.client_id = auth.uid() OR
        transactions.barber_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Admin manage transaction items"
  ON transaction_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Loyalty points policies
CREATE POLICY "Users can view own loyalty points"
  ON loyalty_points FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Admin manage loyalty points"
  ON loyalty_points FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );