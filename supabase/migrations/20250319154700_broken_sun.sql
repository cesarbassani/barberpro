/*
  # Add Delete User Function
  
  1. Changes
    - Add PostgreSQL function to handle user deletion
    - Function will soft-delete auth users
    - Ensures proper permissions and access control
    
  2. Security
    - Function runs with security definer
    - Only accessible to authenticated users
    - Checks admin role before deletion
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

  -- Soft delete the user in auth.users
  UPDATE auth.users
  SET
    raw_app_meta_data = 
      COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      '{"disabled": true, "deleted": true}'::jsonb,
    updated_at = now()
  WHERE id = userid;
END;
$$;