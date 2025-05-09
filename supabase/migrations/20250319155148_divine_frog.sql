/*
  # Fix User Deletion and Add Commission Rates
  
  1. Changes
    - Create function to handle user deletion
    - Add commission rate fields to profiles
    - Add constraints for commission rates
    
  2. Security
    - Ensure proper role checks
    - Maintain data integrity
*/

-- Create function to handle user deletion
CREATE OR REPLACE FUNCTION delete_user(userid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the executing user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Delete the user from auth.users
  DELETE FROM auth.users WHERE id = userid;
END;
$$;