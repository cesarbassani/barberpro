/*
  # Import Initial Products Data
  
  1. Changes
    - Import products from Excel data
    - Link to correct categories
    - Set default values
    
  2. Security
    - Maintain data integrity
    - Use proper foreign key references
*/

-- First add unique constraint on product name
ALTER TABLE products
ADD CONSTRAINT products_name_key UNIQUE (name);

-- Insert products with their categories
INSERT INTO products (name, price, stock_quantity, category_id, active, min_stock_alert)
SELECT 
  p.name,
  p.price,
  p.stock,
  c.id as category_id,
  true as active,
  5 as min_stock_alert
FROM (
  VALUES
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
) as p(name, price, stock, category)
JOIN categories c ON LOWER(c.name) = LOWER(p.category)
WHERE c.type IN ('product', 'both')
ON CONFLICT ON CONSTRAINT products_name_key 
DO NOTHING;