/*
  # Fix Profiles RLS Policies for Admin User Creation
  
  1. Changes
    - Update RLS policies for profiles table
    - Allow admin users to create profiles for other users
    - Fix function reference to use auth.uid() instead of uid()
    
  2. Security
    - Maintain proper access control
    - Ensure admins can create users through the UI
*/

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "public"."profiles";

-- Create new insert policy that allows admins to create profiles for others
CREATE POLICY "Enable insert for authenticated users" ON "public"."profiles"
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = id) OR 
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ))
);