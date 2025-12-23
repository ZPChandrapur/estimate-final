/*
  # Update Work Assignments RLS - Allow All Authenticated Users
  
  1. Problem
    - Current RLS policies only allow admin/super_admin/developer to create assignments
    - Users cannot assign other users to works
    
  2. Changes
    - Drop existing restrictive policies
    - Create new policies that allow ANY authenticated user to manage assignments
    - Users can insert, update, and delete assignments for any work
    - All authenticated users can view all assignments
    
  3. Security
    - RLS is still enabled
    - Only authenticated users can perform operations
    - Anonymous users cannot access work_assignments
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can create work assignments" ON estimate.work_assignments;
DROP POLICY IF EXISTS "Admins can update work assignments" ON estimate.work_assignments;
DROP POLICY IF EXISTS "Admins can delete work assignments" ON estimate.work_assignments;
DROP POLICY IF EXISTS "Admins can view all work assignments" ON estimate.work_assignments;
DROP POLICY IF EXISTS "Users can view own work assignments" ON estimate.work_assignments;

-- Create new policies that allow any authenticated user

-- SELECT: Any authenticated user can view all work assignments
CREATE POLICY "Authenticated users can view all work assignments"
  ON estimate.work_assignments
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Any authenticated user can create work assignments
CREATE POLICY "Authenticated users can create work assignments"
  ON estimate.work_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Any authenticated user can update work assignments
CREATE POLICY "Authenticated users can update work assignments"
  ON estimate.work_assignments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Any authenticated user can delete work assignments
CREATE POLICY "Authenticated users can delete work assignments"
  ON estimate.work_assignments
  FOR DELETE
  TO authenticated
  USING (true);
