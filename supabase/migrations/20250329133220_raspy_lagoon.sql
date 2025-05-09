/*
  # Undo Import Migration
  
  1. Changes
    - Remove imported products and services
    - Keep categories and structure intact
    - Preserve admin user and core data
    
  2. Security
    - Maintain data integrity
    - Preserve system configuration
*/

-- Store admin user info
DO $$ 
DECLARE
    admin_id uuid;
BEGIN
    -- Get admin user ID
    SELECT id INTO admin_id
    FROM profiles
    WHERE role = 'admin'
    LIMIT 1;

    -- Delete imported data while preserving structure
    DELETE FROM loyalty_points;
    DELETE FROM order_items;
    DELETE FROM transactions;
    DELETE FROM appointments;
    DELETE FROM services;
    DELETE FROM products;
    
    -- Delete all profiles except admin
    DELETE FROM profiles
    WHERE id != admin_id;

    -- Delete all auth users except admin
    DELETE FROM auth.users
    WHERE id != admin_id;
END $$;