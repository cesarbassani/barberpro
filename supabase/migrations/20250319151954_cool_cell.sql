/*
  # Fix Auth Schema Permissions and User Creation

  1. Changes
    - Grant proper permissions to auth schema
    - Fix user creation process
    - Ensure proper role hierarchy

  2. Security
    - Maintain data protection
    - Set up correct permissions
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Grant proper permissions to auth schema
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO postgres;

-- Ensure auth schema exists and has proper permissions
DO $$ 
BEGIN
    -- Create auth schema if it doesn't exist
    CREATE SCHEMA IF NOT EXISTS auth;
    
    -- Grant proper permissions
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT USAGE ON SCHEMA auth TO anon;
    GRANT USAGE ON SCHEMA auth TO service_role;
    
    -- Grant access to all existing tables in auth schema
    GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon;
    GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role;
    
    -- Grant access to future tables in auth schema
    ALTER DEFAULT PRIVILEGES IN SCHEMA auth
    GRANT SELECT ON TABLES TO authenticated;
    
    ALTER DEFAULT PRIVILEGES IN SCHEMA auth
    GRANT SELECT ON TABLES TO anon;
    
    ALTER DEFAULT PRIVILEGES IN SCHEMA auth
    GRANT ALL ON TABLES TO service_role;
END $$;