/*
  # Create Admin User
  
  1. Changes
    - Create admin user in auth.users table
    - Create corresponding admin profile
    - Use proper error handling
    
  2. Security
    - Ensure proper user creation
    - Maintain data integrity
*/

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create admin user and profile
DO $$ 
DECLARE
    admin_user_id uuid;
BEGIN
    -- First, delete from profiles (child table) if exists
    DELETE FROM public.profiles 
    WHERE id IN (
        SELECT id FROM auth.users WHERE email = 'admin@barberpro.com'
    );
    
    -- Then delete from auth.users if exists
    DELETE FROM auth.users WHERE email = 'admin@barberpro.com';

    -- Insert new admin user with minimal required fields
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        aud,
        role
    )
    VALUES (
        gen_random_uuid(),
        'admin@barberpro.com',
        crypt('admin123', gen_salt('bf')),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{}',
        NOW(),
        NOW(),
        'authenticated',
        'authenticated'
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

    -- Raise notice for successful creation
    RAISE NOTICE 'Admin user created successfully with id: %', admin_user_id;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error creating admin user: %', SQLERRM;
        RAISE;
END $$;