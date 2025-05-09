/*
  # Add email column to profiles table

  1. Changes
    - Add `email` column to `profiles` table
    - Create index on `email` column for efficient querying
    - Add unique constraint to ensure email uniqueness
*/

-- Add email column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email text;

-- Create index for email column
CREATE INDEX IF NOT EXISTS idx_profiles_email 
ON profiles(email);

-- Add unique constraint
ALTER TABLE profiles
ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- Update existing profiles with email from auth.users
DO $$
BEGIN
  UPDATE profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id
  AND p.email IS NULL;
END $$;