/*
  # Fix Product Categories Migration
  
  1. Changes
    - Add IF NOT EXISTS checks
    - Handle existing table gracefully
    - Ensure proper column addition
    - Maintain existing data
    
  2. Security
    - Preserve existing permissions
    - Maintain data integrity
*/

-- Create product categories table if it doesn't exist
DO $$ 
BEGIN
  -- Create table if it doesn't exist
  CREATE TABLE IF NOT EXISTS product_categories (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    description text,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );

  -- Create trigger if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_product_categories_updated_at'
  ) THEN
    CREATE TRIGGER update_product_categories_updated_at
      BEFORE UPDATE ON product_categories
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- Add category_id to products table if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' 
    AND column_name = 'category_id'
  ) THEN
    ALTER TABLE products
    ADD COLUMN category_id uuid REFERENCES product_categories(id);
  END IF;

  -- Enable RLS
  ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

  -- Drop existing policies to avoid conflicts
  DROP POLICY IF EXISTS "Public read access for product categories" ON product_categories;
  DROP POLICY IF EXISTS "Admin manage product categories" ON product_categories;

  -- Create policies
  CREATE POLICY "Public read access for product categories"
    ON product_categories FOR SELECT
    USING (true);

  CREATE POLICY "Admin manage product categories"
    ON product_categories FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    );

  -- Insert default categories if they don't exist
  INSERT INTO product_categories (name, description)
  SELECT name, description
  FROM (VALUES
    ('Shampoos', 'Produtos para limpeza e cuidados com o cabelo'),
    ('Condicionadores', 'Produtos para hidratação e tratamento'),
    ('Pomadas', 'Produtos para modelagem e fixação'),
    ('Óleos', 'Produtos para barba e cabelo'),
    ('Lâminas', 'Produtos para barbear'),
    ('Acessórios', 'Pentes, escovas e outros acessórios')
  ) AS v(name, description)
  WHERE NOT EXISTS (
    SELECT 1 FROM product_categories 
    WHERE name = v.name
  );

  -- Create index if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_products_category_id'
  ) THEN
    CREATE INDEX idx_products_category_id ON products(category_id);
  END IF;

END $$;