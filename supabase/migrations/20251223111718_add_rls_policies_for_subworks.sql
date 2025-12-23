/*
  # Add RLS Policies for Subworks Table
  
  1. Problem
    - The subworks table has RLS enabled but NO policies
    - This blocks all users from viewing subworks created by others
    - Users cannot see subworks they didn't create themselves
    
  2. Changes
    - Add comprehensive RLS policies for subworks table
    - Allow all authenticated users to view all subworks
    - Allow all authenticated users to create, update, and delete subworks
    
  3. Security
    - RLS remains enabled
    - Only authenticated users can access data
    - Anonymous users cannot access subworks
*/

-- SELECT: Any authenticated user can view all subworks
CREATE POLICY "Authenticated users can view all subworks"
  ON estimate.subworks
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Any authenticated user can create subworks
CREATE POLICY "Authenticated users can create subworks"
  ON estimate.subworks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Any authenticated user can update subworks
CREATE POLICY "Authenticated users can update subworks"
  ON estimate.subworks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Any authenticated user can delete subworks
CREATE POLICY "Authenticated users can delete subworks"
  ON estimate.subworks
  FOR DELETE
  TO authenticated
  USING (true);
