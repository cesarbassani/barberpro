/*
  # Fix User Deletion Cascade
  
  1. Changes
    - Add cascade delete to foreign key constraints
    - Remove delete_user function as it's no longer needed
    
  2. Security
    - Maintain data integrity through proper cascading
    - Ensure proper cleanup of related records
*/

-- Drop the delete_user function as we'll handle deletion directly
DROP FUNCTION IF EXISTS delete_user(uuid);

-- Recreate foreign key constraints with CASCADE
ALTER TABLE appointments 
  DROP CONSTRAINT IF EXISTS appointments_client_id_fkey,
  DROP CONSTRAINT IF EXISTS appointments_barber_id_fkey;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_client_id_fkey 
    FOREIGN KEY (client_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE,
  ADD CONSTRAINT appointments_barber_id_fkey 
    FOREIGN KEY (barber_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;

ALTER TABLE transactions 
  DROP CONSTRAINT IF EXISTS transactions_client_id_fkey,
  DROP CONSTRAINT IF EXISTS transactions_barber_id_fkey;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_client_id_fkey 
    FOREIGN KEY (client_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE,
  ADD CONSTRAINT transactions_barber_id_fkey 
    FOREIGN KEY (barber_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;

ALTER TABLE loyalty_points 
  DROP CONSTRAINT IF EXISTS loyalty_points_client_id_fkey;

ALTER TABLE loyalty_points
  ADD CONSTRAINT loyalty_points_client_id_fkey 
    FOREIGN KEY (client_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;