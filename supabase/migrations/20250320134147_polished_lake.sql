/*
  # Fix Transactions Foreign Key Constraint
  
  1. Changes
    - Update transactions table foreign key to reference clients table
    - Drop existing constraint
    - Add new constraint
    
  2. Security
    - Maintain data integrity
    - Ensure proper referential integrity
*/

-- Drop existing foreign key constraint
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_client_id_fkey;

-- Add new foreign key constraint referencing clients table
ALTER TABLE transactions
ADD CONSTRAINT transactions_client_id_fkey
FOREIGN KEY (client_id) REFERENCES clients(id)
ON DELETE CASCADE;