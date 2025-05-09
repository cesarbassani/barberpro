/*
  # Fix Authentication Schema and Permissions

  1. Changes
    - Ensure proper schema permissions
    - Fix auth schema access
    - Update RLS policies
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;

-- Grant proper permissions
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA auth TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO postgres;

-- Grant access to auth schema for authentication
GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;

-- Grant access to all existing tables in auth schema
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role;

-- Grant access to future tables in auth schema
ALTER DEFAULT PRIVILEGES IN SCHEMA auth
GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA auth
GRANT SELECT ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA auth
GRANT ALL ON TABLES TO service_role;

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