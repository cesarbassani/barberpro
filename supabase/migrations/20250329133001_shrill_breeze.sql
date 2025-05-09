/*
  # Add Default Categories
  
  1. Changes
    - Add default categories for services and products
    - Add unique constraint on name
    - Ensure proper type assignments
    
  2. Security
    - Maintain data integrity
    - Prevent duplicate categories
*/

-- First add a unique constraint on the name column
ALTER TABLE categories
ADD CONSTRAINT categories_name_key UNIQUE (name);

-- Now insert default categories
INSERT INTO categories (name, description, type)
VALUES
  ('Bar', 'Cervejas e bebidas', 'product'),
  ('Barbearia', 'Serviços de barbearia', 'both'),
  ('Barbershop', 'Produtos para barba e cabelo', 'product'),
  ('Estética', 'Limpeza de pele, depilação e outros serviços estéticos', 'both'),
  ('Shampoos', 'Produtos para limpeza e cuidados com o cabelo', 'product'),
  ('Condicionadores', 'Produtos para hidratação e tratamento', 'product'),
  ('Pomadas', 'Produtos para modelagem e fixação', 'product'),
  ('Óleos', 'Produtos para barba e cabelo', 'product'),
  ('Lâminas', 'Produtos para barbear', 'product'),
  ('Acessórios', 'Pentes, escovas e outros acessórios', 'product'),
  ('Cortes', 'Serviços de corte de cabelo', 'service'),
  ('Barba', 'Serviços de barba e bigode', 'service'),
  ('Tratamentos', 'Serviços de tratamento capilar', 'service'),
  ('Spa', 'Serviços de relaxamento e bem-estar', 'service'),
  ('Depilação', 'Serviços de depilação', 'service'),
  ('Limpeza de Pele', 'Serviços de limpeza e tratamento facial', 'service')
ON CONFLICT (name) DO NOTHING;