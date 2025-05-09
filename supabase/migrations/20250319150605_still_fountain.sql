/*
  # Create Default Admin User

  1. Changes
    - Insert default admin user in auth.users
    - Create admin profile in profiles table
    
  2. Security
    - Sets up initial admin access
    - Uses secure password hashing
*/

-- First, create the admin user in auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@barberpro.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'admin@barberpro.com'
);

-- Then, create the admin profile
INSERT INTO public.profiles (
  id,
  role,
  full_name,
  created_at,
  updated_at
)
SELECT
  id,
  'admin',
  'Administrador',
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'admin@barberpro.com'
AND NOT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE role = 'admin'
);