/*
  # Fix Duplicate SELECT Policies on Works Table
  
  1. Problem
    - Multiple SELECT policies exist on estimate.works table:
      * "Users can view all works" (old, unrestricted)
      * "Users can view assigned works" (new, restricted)
    - The old policy was not properly dropped
    - This causes confusion and potential access issues
    
  2. Changes
    - Drop all existing SELECT policies on works table
    - Recreate the intended "Users can view assigned works" policy
    - This ensures only authorized users can view works
    
  3. Security
    - Users can only view works if they:
      * Are admin/super_admin/developer, OR
      * Are assigned to the work, OR
      * Created the work
*/

-- Drop ALL existing SELECT policies on works table
DROP POLICY IF EXISTS "Users can view works" ON estimate.works;
DROP POLICY IF EXISTS "Users can view all works" ON estimate.works;
DROP POLICY IF EXISTS "Users can view assigned works" ON estimate.works;

-- Recreate the correct restrictive policy
CREATE POLICY "Users can view assigned works"
  ON estimate.works
  FOR SELECT
  TO authenticated
  USING (
    -- User is admin/super_admin/developer (can see all works)
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
    OR
    -- User is assigned to this work
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = works.works_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    -- User created the work
    created_by = auth.uid()
  );
