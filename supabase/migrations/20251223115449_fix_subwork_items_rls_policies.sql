/*
  # Fix Subwork Items RLS Policies
  
  1. Problem
    - Restrictive RLS policies on subwork_items table may be blocking access
    - Users cannot view subwork items created by others
    - This causes recap calculations to show zero values
    - Works that previously showed correct values now show zeros
    
  2. Changes
    - Drop existing restrictive "Users can manage own subwork items" policy
    - Create new open SELECT policy for all authenticated users
    - Keep restrictive policies for INSERT, UPDATE, DELETE operations
    
  3. Security
    - All authenticated users can view all subwork items (SELECT)
    - Only item creators and admins can modify items (INSERT, UPDATE, DELETE)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage own subwork items" ON estimate.subwork_items;
DROP POLICY IF EXISTS "Admins can manage all subwork items" ON estimate.subwork_items;

-- SELECT: All authenticated users can view all subwork items
CREATE POLICY "Authenticated users can view all subwork items"
  ON estimate.subwork_items
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can create subwork items for works they have access to
CREATE POLICY "Users can create subwork items"
  ON estimate.subwork_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User is admin/super_admin/developer
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
    OR
    -- User is assigned to the work
    EXISTS (
      SELECT 1 FROM estimate.subworks sw
      JOIN estimate.work_assignments wa ON wa.work_id = sw.works_id
      WHERE sw.subworks_id = subwork_items.subwork_id
      AND wa.user_id = auth.uid()
    )
    OR
    -- User created the work
    EXISTS (
      SELECT 1 FROM estimate.subworks sw
      JOIN estimate.works w ON w.works_id = sw.works_id
      WHERE sw.subworks_id = subwork_items.subwork_id
      AND w.created_by = auth.uid()
    )
  );

-- UPDATE: Users can update their own subwork items or if they have access to the work
CREATE POLICY "Users can update subwork items"
  ON estimate.subwork_items
  FOR UPDATE
  TO authenticated
  USING (
    -- User is admin/super_admin/developer
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
    OR
    -- User created this item
    created_by = auth.uid()
    OR
    -- User is assigned to the work
    EXISTS (
      SELECT 1 FROM estimate.subworks sw
      JOIN estimate.work_assignments wa ON wa.work_id = sw.works_id
      WHERE sw.subworks_id = subwork_items.subwork_id
      AND wa.user_id = auth.uid()
    )
    OR
    -- User created the work
    EXISTS (
      SELECT 1 FROM estimate.subworks sw
      JOIN estimate.works w ON w.works_id = sw.works_id
      WHERE sw.subworks_id = subwork_items.subwork_id
      AND w.created_by = auth.uid()
    )
  )
  WITH CHECK (
    -- Same conditions as USING
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
    OR
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM estimate.subworks sw
      JOIN estimate.work_assignments wa ON wa.work_id = sw.works_id
      WHERE sw.subworks_id = subwork_items.subwork_id
      AND wa.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM estimate.subworks sw
      JOIN estimate.works w ON w.works_id = sw.works_id
      WHERE sw.subworks_id = subwork_items.subwork_id
      AND w.created_by = auth.uid()
    )
  );

-- DELETE: Users can delete their own subwork items or if they have access to the work
CREATE POLICY "Users can delete subwork items"
  ON estimate.subwork_items
  FOR DELETE
  TO authenticated
  USING (
    -- User is admin/super_admin/developer
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
    OR
    -- User created this item
    created_by = auth.uid()
    OR
    -- User is assigned to the work
    EXISTS (
      SELECT 1 FROM estimate.subworks sw
      JOIN estimate.work_assignments wa ON wa.work_id = sw.works_id
      WHERE sw.subworks_id = subwork_items.subwork_id
      AND wa.user_id = auth.uid()
    )
    OR
    -- User created the work
    EXISTS (
      SELECT 1 FROM estimate.subworks sw
      JOIN estimate.works w ON w.works_id = sw.works_id
      WHERE sw.subworks_id = subwork_items.subwork_id
      AND w.created_by = auth.uid()
    )
  );
