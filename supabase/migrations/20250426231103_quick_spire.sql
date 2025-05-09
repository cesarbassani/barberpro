/*
  # Add settings table for storing application configurations

  1. New Tables
    - `settings`
      - `key` (text, primary key)
      - `value` (jsonb)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)
  
  2. Security
    - Enable RLS on `settings` table
    - Add policy for admin users to manage settings
    - Add policy for authenticated users to read settings
*/

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can manage settings"
  ON settings
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

CREATE POLICY "Authenticated users can read settings"
  ON settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();