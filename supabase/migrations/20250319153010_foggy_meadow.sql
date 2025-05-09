/*
  # Update First User to Admin Role

  1. Changes
    - Update the first user's role to admin
    - Use proper SQL syntax for ordered update
    
  2. Security
    - Maintain data integrity
    - Preserve user data
*/

WITH first_client AS (
  SELECT id
  FROM public.profiles
  WHERE role = 'client'
  ORDER BY created_at ASC
  LIMIT 1
)
UPDATE public.profiles
SET 
  role = 'admin',
  updated_at = NOW()
WHERE id IN (SELECT id FROM first_client);