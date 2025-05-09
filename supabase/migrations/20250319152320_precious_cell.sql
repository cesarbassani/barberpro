/*
  # Fix Authentication Schema and Permissions

  1. Changes
    - Ensure auth schema exists
    - Set up proper permissions
    - Fix user authentication tables
    - Add missing auth functions
*/

-- Create auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;

-- Grant proper permissions
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA auth TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO postgres;

-- Ensure proper RLS policies for profiles table
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;

-- Create new policies
CREATE POLICY "Enable read access for all users"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on id"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ))
  WITH CHECK (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

-- Create default admin user if it doesn't exist
DO $$ 
DECLARE
    admin_user_id uuid;
BEGIN
    -- Check if admin user exists
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = 'admin@barberpro.com';

    -- If admin user doesn't exist, create one
    IF admin_user_id IS NULL THEN
        -- Create admin profile
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