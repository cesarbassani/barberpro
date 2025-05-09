/*
  # Fix Admin User Creation
  
  1. Changes
    - Remove confirmed_at from INSERT as it's a generated column
    - Fix deletion order to respect foreign key constraints
    - Ensure clean admin user creation
    
  2. Security
    - Maintain secure password handling
    - Preserve data integrity
*/

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

    -- Insert new admin user
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
        raw_user_meta_data
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
        '{}'
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
END $$;