/*
  # Fix Categories and Import Products
  
  1. Changes
    - Update category names to match Excel data
    - Import products with correct category references
    
  2. Security
    - Maintain data integrity
    - Preserve existing relationships
*/

-- First, update the categories to match Excel data
UPDATE categories SET name = 'Barbershop' WHERE name = 'Barbershop';

-- Make sure we have all required categories
INSERT INTO categories (name, description, type)
VALUES
  ('Shampoos', 'Produtos para limpeza e cuidados com o cabelo', 'product'),
  ('Pomadas', 'Produtos para modelagem e fixação', 'product'),
  ('Óleos', 'Produtos para barba e cabelo', 'product'),
  ('Acessórios', 'Pentes, escovas e outros acessórios', 'product'),
  ('Lâminas', 'Produtos para barbear', 'product'),
  ('Condicionadores', 'Produtos para hidratação e tratamento', 'product')
ON CONFLICT (name) DO NOTHING;

-- Ensure unique constraint on products
ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_name_key;

ALTER TABLE products
ADD CONSTRAINT products_name_key UNIQUE (name);

-- Import products with correct category references
WITH product_data AS (
  SELECT * FROM (VALUES
    ('Shampoo Anticaspa', 29.90, 50, 'Shampoos'),
    ('Pomada Modeladora', 45.00, 30, 'Pomadas'),
    ('Óleo para Barba', 35.90, 25, 'Óleos'),
    ('Pente Profissional', 15.00, 40, 'Acessórios'),
    ('Máquina de Corte', 299.90, 10, 'Acessórios'),
    ('Gel Fixador', 25.00, 45, 'Pomadas'),
    ('Cera Modeladora', 39.90, 35, 'Pomadas'),
    ('Shampoo para Barba', 32.00, 30, 'Shampoos'),
    ('Condicionador Hidratante', 27.90, 40, 'Condicionadores'),
    ('Escova para Barba', 22.00, 25, 'Acessórios'),
    ('Navalha Profissional', 89.90, 15, 'Lâminas'),
    ('Lâminas de Barbear (10un)', 45.00, 50, 'Lâminas'),
    ('Loção Pós Barba', 29.90, 30, 'Óleos'),
    ('Talco para Barba', 19.90, 40, 'Acessórios'),
    ('Kit Barba Completo', 149.90, 10, 'Acessórios')
  ) AS t(name, price, stock, category)
)
INSERT INTO products (
  name,
  price,
  stock_quantity,
  category_id,
  active,
  min_stock_alert,
  description
)
SELECT 
  pd.name,
  pd.price,
  pd.stock,
  c.id,
  true,
  5,
  'Produto importado automaticamente'
FROM product_data pd
JOIN categories c ON c.name = pd.category
WHERE c.type IN ('product', 'both')
ON CONFLICT ON CONSTRAINT products_name_key 
DO NOTHING;