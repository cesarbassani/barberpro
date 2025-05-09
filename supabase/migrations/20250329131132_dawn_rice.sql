/*
  # Clean Database While Preserving Admin User
  
  1. Changes
    - Delete all data except admin user
    - Preserve admin profile and auth user
    - Reset all tables to empty state
    
  2. Security
    - Maintain admin access
    - Preserve database structure
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

    -- Delete all data from tables in correct order to respect foreign keys
    DELETE FROM loyalty_points;
    DELETE FROM order_items;
    DELETE FROM transactions;
    DELETE FROM appointments;
    DELETE FROM services;
    DELETE FROM products;
    DELETE FROM categories;
    DELETE FROM clients;
    
    -- Delete all profiles except admin
    DELETE FROM profiles
    WHERE id != admin_id;

    -- Delete all auth users except admin
    DELETE FROM auth.users
    WHERE id != admin_id;
END $$;