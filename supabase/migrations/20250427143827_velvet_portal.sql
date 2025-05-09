/*
  # Add CPF Support for Clients
  
  1. Changes
    - Add CPF column to clients table
    - Add index for better performance
    - Add validation function for CPF format
*/

-- Create function to validate CPF format
CREATE OR REPLACE FUNCTION is_valid_cpf(cpf text)
RETURNS boolean AS $$
BEGIN
  -- Remove any non-digit characters
  cpf := regexp_replace(cpf, '\D', '', 'g');
  
  -- Check if it has 11 digits
  IF length(cpf) != 11 THEN
    RETURN false;
  END IF;
  
  -- Check if all digits are the same
  IF cpf ~ '^(\d)\1*$' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add CPF column to clients table
ALTER TABLE clients
ADD COLUMN cpf text,
ADD CONSTRAINT clients_cpf_check CHECK (
  cpf IS NULL OR is_valid_cpf(cpf)
);

-- Create index for CPF lookups
CREATE INDEX idx_clients_cpf ON clients(cpf);

-- Add unique constraint for CPF
ALTER TABLE clients
ADD CONSTRAINT clients_cpf_unique UNIQUE (cpf);