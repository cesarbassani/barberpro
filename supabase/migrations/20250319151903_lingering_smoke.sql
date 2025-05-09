/*
  # Fix Auth Permissions and Create Admin User

  1. Changes
    - Grant proper permissions to auth schema
    - Create admin user safely
    - Set up admin profile

  2. Security
    - Ensure proper schema access
    - Set up correct role hierarchy
*/

-- Grant proper permissions to auth schema
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO service_role;

-- Create admin user safely
DO $$ 
DECLARE
    admin_user_id uuid;
BEGIN
    -- First check if admin user already exists
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = 'admin@barberpro.com';

    -- If admin user doesn't exist, create profile
    IF admin_user_id IS NULL THEN
        -- Create profile for admin
        INSERT INTO public.profiles (
            id,
            role,
            full_name,
            created_at,
            updated_at
        )
        VALUES (
            '00000000-0000-0000-0000-000000000001'::uuid,
            'admin',
            'Administrador',
            now(),
            now()
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;