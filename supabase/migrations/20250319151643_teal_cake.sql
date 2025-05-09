/*
  # Fix Authentication Setup

  1. Changes
    - Drop existing admin user to avoid conflicts
    - Create admin user with proper password hashing
    - Ensure proper profile creation
    - Set up correct permissions

  2. Security
    - Use proper password hashing
    - Set up correct role assignments
    - Ensure email confirmation
*/

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create or replace the admin user
DO $$ 
DECLARE
    admin_user_id uuid;
BEGIN
    -- First, delete existing admin user and profile if they exist
    DELETE FROM public.profiles 
    WHERE id IN (
        SELECT id FROM auth.users WHERE email = 'admin@barberpro.com'
    );
    DELETE FROM auth.users WHERE email = 'admin@barberpro.com';

    -- Insert new admin user
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        aud,
        role,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        is_sso_user,
        instance_id
    )
    VALUES (
        gen_random_uuid(),
        'admin@barberpro.com',
        crypt('admin123', gen_salt('bf')),
        now(),
        now(),
        now(),
        'authenticated',
        'authenticated',
        jsonb_build_object(
            'provider', 'email',
            'providers', array['email']
        ),
        '{}'::jsonb,
        false,
        false,
        '00000000-0000-0000-0000-000000000000'::uuid
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
        now(),
        now()
    );

    -- Grant necessary permissions
    GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon, authenticated;

    RAISE NOTICE 'Admin user created successfully with id: %', admin_user_id;
END $$;