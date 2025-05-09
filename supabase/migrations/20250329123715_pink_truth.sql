/*
  # Add Product Categories Support
  
  1. New Tables
    - `product_categories`
      - Stores product category information
      - Includes name, description, and active status
    
  2. Changes
    - Add category_id to products table
    - Create foreign key relationship
    - Set up RLS policies
    
  3. Security
    - Enable RLS
    - Add proper access policies
*/

-- Create product categories table
CREATE TABLE product_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add trigger for updated_at
CREATE TRIGGER update_product_categories_updated_at
    BEFORE UPDATE ON product_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add category_id to products table
ALTER TABLE products
ADD COLUMN category_id uuid REFERENCES product_categories(id);

-- Enable RLS on product_categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for product_categories
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

-- Insert default categories
INSERT INTO product_categories (name, description) VALUES
  ('Shampoos', 'Produtos para limpeza e cuidados com o cabelo'),
  ('Condicionadores', 'Produtos para hidratação e tratamento'),
  ('Pomadas', 'Produtos para modelagem e fixação'),
  ('Óleos', 'Produtos para barba e cabelo'),
  ('Lâminas', 'Produtos para barbear'),
  ('Acessórios', 'Pentes, escovas e outros acessórios');

-- Create index for better performance
CREATE INDEX idx_products_category_id ON products(category_id);