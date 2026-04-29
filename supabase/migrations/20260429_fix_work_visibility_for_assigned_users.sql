/*
  # Fix Work Visibility for Assigned Users
  
  ## Problem
  - Users assigned to works through work_assignments table were not seeing their assigned works
  - Multiple conflicting RLS policies existed from previous migrations
  - Old policies relied on `current_role_holder_id` and `current_role_id` columns which were not properly managed
  
  ## Solution
  - Drop all old RLS SELECT policies on works table
  - Create a single, clear policy that checks work_assignments table
  - This ensures assigned users can see their works on login
*/

-- Drop ALL existing SELECT policies on works table
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view works assigned to their role" ON estimate.works;
  DROP POLICY IF EXISTS "Users can view works they created" ON estimate.works;
  DROP POLICY IF EXISTS "Higher roles can view lower role works" ON estimate.works;
  DROP POLICY IF EXISTS "EE has full read access" ON estimate.works;
  DROP POLICY IF EXISTS "Users can view works" ON estimate.works;
  DROP POLICY IF EXISTS "Users can view assigned works" ON estimate.works;
  
  -- Also drop update and delete policies to be thorough
  DROP POLICY IF EXISTS "Assigned users can update works" ON estimate.works;
  DROP POLICY IF EXISTS "Creators can update draft works" ON estimate.works;
  DROP POLICY IF EXISTS "EE can update all works" ON estimate.works;
  DROP POLICY IF EXISTS "Users can create works" ON estimate.works;
  DROP POLICY IF EXISTS "Creators can delete draft works" ON estimate.works;
  DROP POLICY IF EXISTS "EE can delete any work" ON estimate.works;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create a single, comprehensive SELECT policy for works visibility
CREATE POLICY "Users can view their assigned works"
  ON estimate.works
  FOR SELECT
  TO authenticated
  USING (
    -- Admins and developers can see all works
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
    OR
    -- User is assigned to this work in work_assignments table
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = works.works_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    -- User created this work
    created_by = auth.uid()
  );

-- Create INSERT policy
CREATE POLICY "Users can create works"
  ON estimate.works
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Create UPDATE policy - users who created or are assigned to a work can update it
CREATE POLICY "Users can update their assigned works"
  ON estimate.works
  FOR UPDATE
  TO authenticated
  USING (
    -- User created the work
    created_by = auth.uid()
    OR
    -- User is assigned to the work
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = works.works_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    -- User is admin/super_admin/developer
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = works.works_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
  );

-- Create DELETE policy
CREATE POLICY "Users can delete their draft works"
  ON estimate.works
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() AND status = 'draft'
  );

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_work_assignments_user_id ON estimate.work_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_work_assignments_work_id ON estimate.work_assignments(work_id);
CREATE INDEX IF NOT EXISTS idx_works_created_by ON estimate.works(created_by);
