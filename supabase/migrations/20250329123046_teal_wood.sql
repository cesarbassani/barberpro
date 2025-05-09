/*
  # Add Service Categories
  
  1. New Tables
    - `service_categories`
      - Stores categories for services like spa, barbershop, aesthetics
      - Includes name and description
      - Links to services table
    
  2. Changes
    - Add category_id to services table
    - Add foreign key constraint
    - Update RLS policies
    
  3. Security
    - Enable RLS on new table
    - Add appropriate policies
*/

-- Create service categories table
CREATE TABLE service_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add trigger for updated_at
CREATE TRIGGER update_service_categories_updated_at
    BEFORE UPDATE ON service_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add category_id to services table
ALTER TABLE services
ADD COLUMN category_id uuid REFERENCES service_categories(id);

-- Enable RLS on service_categories
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for service_categories
CREATE POLICY "Public read access for service categories"
  ON service_categories FOR SELECT
  USING (true);

CREATE POLICY "Admin manage service categories"
  ON service_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default categories
INSERT INTO service_categories (name, description) VALUES
  ('Barbearia', 'Serviços tradicionais de barbearia como corte, barba e bigode'),
  ('Spa', 'Serviços de relaxamento e bem-estar'),
  ('Estética', 'Serviços de beleza e cuidados estéticos');

-- Create index for better performance
CREATE INDEX idx_services_category_id ON services(category_id);