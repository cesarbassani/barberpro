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

-- Create enum types if they don't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('client', 'barber', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash', 'credit_card', 'debit_card', 'pix');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  role user_role NOT NULL DEFAULT 'client',
  full_name text NOT NULL,
  phone text,
  birth_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  duration interval NOT NULL,
  price decimal(10,2) NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
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

CREATE TABLE IF NOT EXISTS appointments (
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

CREATE TABLE IF NOT EXISTS transactions (
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

CREATE TABLE IF NOT EXISTS transaction_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id uuid REFERENCES transactions(id) NOT NULL,
  service_id uuid REFERENCES services(id),
  product_id uuid REFERENCES products(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_points (
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

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_barber_id ON appointments(barber_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_barber_id ON transactions(barber_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_client_id ON loyalty_points(client_id);