/*
  # Fix Auth Schema and Admin User Creation
  
  1. Changes
    - Ensure auth schema exists
    - Create admin user with correct structure
    - Handle generated columns properly
    - Fix profile creation
    
  2. Security
    - Maintain secure password handling
    - Preserve data integrity
*/

-- Create auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;

-- Create or replace the admin user
DO $$ 
DECLARE
    admin_user_id uuid;
BEGIN
    -- First, delete from profiles (child table) before users (parent table)
    DELETE FROM public.profiles 
    WHERE id IN (
        SELECT id FROM auth.users WHERE email = 'admin@barberpro.com'
    );
    
    -- Then delete from auth.users
    DELETE FROM auth.users WHERE email = 'admin@barberpro.com';

    -- Insert new admin user with minimal required fields
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        is_sso_user
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'admin@barberpro.com',
        crypt('admin123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{}',
        false,
        false
    )
    RETURNING id INTO admin_user_id;

    -- Create admin profile
    INSERT INTO public.profiles (
        id,
        role,
        full_name,
        created_at,
        updated_at
    )
    VALUES (
        admin_user_id,
        'admin',
        'Administrador',
        NOW(),
        NOW()
    );

    -- Grant necessary permissions
    GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon, authenticated;
END $$;