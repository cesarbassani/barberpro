/*
  # Remove Default Admin User
  
  1. Changes
    - Safely remove the default admin user
    - Clean up related profile data
    
  2. Security
    - Maintain referential integrity
    - Remove sensitive data
*/

-- Remove the admin profile first (due to foreign key constraints)
DELETE FROM public.profiles 
WHERE id IN (
    SELECT id FROM auth.users 
    WHERE email = 'admin@barberpro.com'
);

-- Then remove the auth user
DELETE FROM auth.users 
WHERE email = 'admin@barberpro.com';