/*
  # Import Initial Products Data with Exact Category Matching
  
  1. Changes
    - Import products from Excel data
    - Match categories exactly by name
    - Set default values
    
  2. Security
    - Maintain data integrity
    - Use proper foreign key references
*/

-- First ensure we have the unique constraint
ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_name_key;

ALTER TABLE products
ADD CONSTRAINT products_name_key UNIQUE (name);

-- Insert products with their categories using exact matches
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
  min_stock_alert
)
SELECT 
  pd.name,
  pd.price,
  pd.stock,
  c.id,
  true,
  5
FROM product_data pd
JOIN categories c ON c.name = pd.category
WHERE c.type IN ('product', 'both')
ON CONFLICT ON CONSTRAINT products_name_key 
DO NOTHING;