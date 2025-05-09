/*
  # Initial Schema Setup for BarberPro

  1. New Tables
    - `profiles`
      - Stores user profile information for clients, barbers, and admins
      - Links to Supabase Auth users
      - Includes role, contact info, and preferences
    
    - `services`
      - Catalog of available services
      - Includes pricing, duration, and description
    
    - `products`
      - Inventory of products for sale
      - Tracks stock levels and pricing
    
    - `appointments`
      - Scheduling system for services
      - Links clients, barbers, and services
      - Includes status tracking
    
    - `transactions`
      - Financial records for services and products
      - Tracks payments and commissions
    
    - `loyalty_points`
      - Customer loyalty program tracking
      - Points earned and redeemed

  2. Security
    - RLS policies for each table
    - Role-based access control
    - Data protection compliance
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('client', 'barber', 'admin');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'refunded');
CREATE TYPE payment_method AS ENUM ('cash', 'credit_card', 'debit_card', 'pix');

-- Profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  role user_role NOT NULL DEFAULT 'client',
  full_name text NOT NULL,
  phone text,
  birth_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Services table
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  duration interval NOT NULL,
  price decimal(10,2) NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Products table
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock_alert integer DEFAULT 5,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Appointments table
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES profiles(id) NOT NULL,
  barber_id uuid REFERENCES profiles(id) NOT NULL,
  service_id uuid REFERENCES services(id) NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status appointment_status DEFAULT 'scheduled',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Transactions table
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES profiles(id) NOT NULL,
  barber_id uuid REFERENCES profiles(id),
  appointment_id uuid REFERENCES appointments(id),
  payment_method payment_method NOT NULL,
  payment_status payment_status DEFAULT 'pending',
  total_amount decimal(10,2) NOT NULL,
  commission_amount decimal(10,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Transaction items table (for both services and products)
CREATE TABLE transaction_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id uuid REFERENCES transactions(id) NOT NULL,
  service_id uuid REFERENCES services(id),
  product_id uuid REFERENCES products(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Loyalty points table
CREATE TABLE loyalty_points (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES profiles(id) NOT NULL,
  transaction_id uuid REFERENCES transactions(id) NOT NULL,
  points_earned integer NOT NULL DEFAULT 0,
  points_redeemed integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Services policies
CREATE POLICY "Services are viewable by everyone"
  ON services FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage services"
  ON services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Products policies
CREATE POLICY "Products are viewable by everyone"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Appointments policies
CREATE POLICY "Users can view own appointments"
  ON appointments FOR SELECT
  USING (
    auth.uid() = client_id OR
    auth.uid() = barber_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Clients can create appointments"
  ON appointments FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Users can update own appointments"
  ON appointments FOR UPDATE
  USING (
    auth.uid() = client_id OR
    auth.uid() = barber_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Transactions policies
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (
    auth.uid() = client_id OR
    auth.uid() = barber_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Transaction items policies
CREATE POLICY "Users can view own transaction items"
  ON transaction_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_items.transaction_id
      AND (
        transactions.client_id = auth.uid() OR
        transactions.barber_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role = 'admin'
        )
      )
    )
  );

-- Loyalty points policies
CREATE POLICY "Users can view own loyalty points"
  ON loyalty_points FOR SELECT
  USING (auth.uid() = client_id);

-- Create indexes for better performance
CREATE INDEX idx_appointments_client_id ON appointments(client_id);
CREATE INDEX idx_appointments_barber_id ON appointments(barber_id);
CREATE INDEX idx_appointments_start_time ON appointments(start_time);
CREATE INDEX idx_transactions_client_id ON transactions(client_id);
CREATE INDEX idx_transactions_barber_id ON transactions(barber_id);
CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX idx_loyalty_points_client_id ON loyalty_points(client_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();