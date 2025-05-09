-- Create unified categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('service', 'product', 'both')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access for categories" ON categories;
DROP POLICY IF EXISTS "Admin manage categories" ON categories;

-- Create new policies for categories
CREATE POLICY "Public read access for categories"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Admin manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Migrate existing categories and create new unified categories
INSERT INTO categories (name, description, type)
VALUES
  ('Bar', 'Cervejas e bebidas', 'product'),
  ('Barbearia', 'Serviços de barbearia', 'both'),
  ('Barbershop', 'Produtos para barba e cabelo', 'product'),
  ('Estética', 'Limpeza de pele, depilação e outros serviços estéticos', 'both');

-- Drop existing foreign key constraints
ALTER TABLE services
DROP CONSTRAINT IF EXISTS services_category_id_fkey;

ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_category_id_fkey;

-- Update services table to reference new categories
ALTER TABLE services
ALTER COLUMN category_id TYPE uuid USING category_id::uuid;

ALTER TABLE services
ADD CONSTRAINT services_category_id_fkey
FOREIGN KEY (category_id)
REFERENCES categories(id);

-- Update products table to reference new categories
ALTER TABLE products
ALTER COLUMN category_id TYPE uuid USING category_id::uuid;

ALTER TABLE products
ADD CONSTRAINT products_category_id_fkey
FOREIGN KEY (category_id)
REFERENCES categories(id);

-- Drop old category tables
DROP TABLE IF EXISTS service_categories CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);