/*
  # Fix RLS Policies for Item Rate Analysis, Lead Statements, and BOQ
  
  1. Problem
    - item_rate_analysis: Restrictive policies block viewing others' rate analyses
    - lead_statements: Restrictive policies block proper access to lead data
    - boq: Missing "own works" access - users can't access BOQ for works they created
    
  2. Changes
    - Update item_rate_analysis: Copy subwork_items RLS pattern
    - Update lead_statements: Copy subwork_items RLS pattern
    - Update boq: Add owner access (assigned + own works)
    
  3. Security
    - All authenticated users can view all records (SELECT)
    - Users can modify if: admin OR assigned to work OR created the work
*/

-- =====================================================
-- 1. Fix item_rate_analysis RLS Policies
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read rate analyses" ON estimate.item_rate_analysis;
DROP POLICY IF EXISTS "Authenticated users can insert rate analyses" ON estimate.item_rate_analysis;
DROP POLICY IF EXISTS "Authenticated users can update own rate analyses" ON estimate.item_rate_analysis;
DROP POLICY IF EXISTS "Authenticated users can delete own rate analyses" ON estimate.item_rate_analysis;

-- SELECT: All authenticated users can view all rate analyses
CREATE POLICY "Authenticated users can view all rate analyses"
  ON estimate.item_rate_analysis
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can create rate analyses for works they have access to
CREATE POLICY "Users can create rate analyses"
  ON estimate.item_rate_analysis
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
      SELECT 1 FROM estimate.subwork_items si
      JOIN estimate.subworks sw ON sw.subworks_id = si.subwork_id
      JOIN estimate.work_assignments wa ON wa.work_id = sw.works_id
      WHERE si.sr_no = item_rate_analysis.subwork_item_id
      AND wa.user_id = auth.uid()
    )
    OR
    -- User created the work
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      JOIN estimate.subworks sw ON sw.subworks_id = si.subwork_id
      JOIN estimate.works w ON w.works_id = sw.works_id
      WHERE si.sr_no = item_rate_analysis.subwork_item_id
      AND w.created_by = auth.uid()
    )
  );

-- UPDATE: Users can update rate analyses they have access to
CREATE POLICY "Users can update rate analyses"
  ON estimate.item_rate_analysis
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
    -- User created this rate analysis
    created_by = auth.uid()
    OR
    -- User is assigned to the work
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      JOIN estimate.subworks sw ON sw.subworks_id = si.subwork_id
      JOIN estimate.work_assignments wa ON wa.work_id = sw.works_id
      WHERE si.sr_no = item_rate_analysis.subwork_item_id
      AND wa.user_id = auth.uid()
    )
    OR
    -- User created the work
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      JOIN estimate.subworks sw ON sw.subworks_id = si.subwork_id
      JOIN estimate.works w ON w.works_id = sw.works_id
      WHERE si.sr_no = item_rate_analysis.subwork_item_id
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
      SELECT 1 FROM estimate.subwork_items si
      JOIN estimate.subworks sw ON sw.subworks_id = si.subwork_id
      JOIN estimate.work_assignments wa ON wa.work_id = sw.works_id
      WHERE si.sr_no = item_rate_analysis.subwork_item_id
      AND wa.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      JOIN estimate.subworks sw ON sw.subworks_id = si.subwork_id
      JOIN estimate.works w ON w.works_id = sw.works_id
      WHERE si.sr_no = item_rate_analysis.subwork_item_id
      AND w.created_by = auth.uid()
    )
  );

-- DELETE: Users can delete rate analyses they have access to
CREATE POLICY "Users can delete rate analyses"
  ON estimate.item_rate_analysis
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
    -- User created this rate analysis
    created_by = auth.uid()
    OR
    -- User is assigned to the work
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      JOIN estimate.subworks sw ON sw.subworks_id = si.subwork_id
      JOIN estimate.work_assignments wa ON wa.work_id = sw.works_id
      WHERE si.sr_no = item_rate_analysis.subwork_item_id
      AND wa.user_id = auth.uid()
    )
    OR
    -- User created the work
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      JOIN estimate.subworks sw ON sw.subworks_id = si.subwork_id
      JOIN estimate.works w ON w.works_id = sw.works_id
      WHERE si.sr_no = item_rate_analysis.subwork_item_id
      AND w.created_by = auth.uid()
    )
  );

-- =====================================================
-- 2. Fix lead_statements RLS Policies
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view all lead statements" ON estimate.lead_statements;
DROP POLICY IF EXISTS "Users can insert lead statements for their assigned works" ON estimate.lead_statements;
DROP POLICY IF EXISTS "Users can update lead statements for their assigned works" ON estimate.lead_statements;
DROP POLICY IF EXISTS "Users can delete lead statements for their assigned works" ON estimate.lead_statements;

-- SELECT: All authenticated users can view all lead statements
CREATE POLICY "Authenticated users can view all lead statements"
  ON estimate.lead_statements
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can create lead statements for works they have access to
CREATE POLICY "Users can create lead statements"
  ON estimate.lead_statements
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
      SELECT 1 FROM estimate.work_assignments wa
      WHERE wa.work_id = lead_statements.works_id
      AND wa.user_id = auth.uid()
    )
    OR
    -- User created the work
    EXISTS (
      SELECT 1 FROM estimate.works w
      WHERE w.works_id = lead_statements.works_id
      AND w.created_by = auth.uid()
    )
  );

-- UPDATE: Users can update lead statements they have access to
CREATE POLICY "Users can update lead statements"
  ON estimate.lead_statements
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
    -- User created this lead statement
    created_by = auth.uid()
    OR
    -- User is assigned to the work
    EXISTS (
      SELECT 1 FROM estimate.work_assignments wa
      WHERE wa.work_id = lead_statements.works_id
      AND wa.user_id = auth.uid()
    )
    OR
    -- User created the work
    EXISTS (
      SELECT 1 FROM estimate.works w
      WHERE w.works_id = lead_statements.works_id
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
      SELECT 1 FROM estimate.work_assignments wa
      WHERE wa.work_id = lead_statements.works_id
      AND wa.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM estimate.works w
      WHERE w.works_id = lead_statements.works_id
      AND w.created_by = auth.uid()
    )
  );

-- DELETE: Users can delete lead statements they have access to
CREATE POLICY "Users can delete lead statements"
  ON estimate.lead_statements
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
    -- User created this lead statement
    created_by = auth.uid()
    OR
    -- User is assigned to the work
    EXISTS (
      SELECT 1 FROM estimate.work_assignments wa
      WHERE wa.work_id = lead_statements.works_id
      AND wa.user_id = auth.uid()
    )
    OR
    -- User created the work
    EXISTS (
      SELECT 1 FROM estimate.works w
      WHERE w.works_id = lead_statements.works_id
      AND w.created_by = auth.uid()
    )
  );

-- =====================================================
-- 3. Fix boq RLS Policies (Add Owner Access)
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view BOQ for assigned works" ON estimate.boq;
DROP POLICY IF EXISTS "Users can create BOQ for assigned works" ON estimate.boq;
DROP POLICY IF EXISTS "Users can update BOQ for assigned works" ON estimate.boq;
DROP POLICY IF EXISTS "Admins can delete BOQ" ON estimate.boq;

-- SELECT: Users can view BOQ for assigned or owned works
CREATE POLICY "Users can view BOQ for assigned or owned works"
  ON estimate.boq
  FOR SELECT
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
    -- User is assigned to the work
    EXISTS (
      SELECT 1 FROM estimate.work_assignments wa
      WHERE wa.work_id = boq.work_id
      AND wa.user_id = auth.uid()
    )
    OR
    -- User created the work
    EXISTS (
      SELECT 1 FROM estimate.works w
      WHERE w.works_id = boq.work_id
      AND w.created_by = auth.uid()
    )
    OR
    -- User generated this BOQ
    generated_by = auth.uid()
  );

-- INSERT: Users can create BOQ for assigned or owned works
CREATE POLICY "Users can create BOQ for assigned or owned works"
  ON estimate.boq
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
      SELECT 1 FROM estimate.work_assignments wa
      WHERE wa.work_id = boq.work_id
      AND wa.user_id = auth.uid()
    )
    OR
    -- User created the work
    EXISTS (
      SELECT 1 FROM estimate.works w
      WHERE w.works_id = boq.work_id
      AND w.created_by = auth.uid()
    )
  );

-- UPDATE: Users can update BOQ for assigned or owned works
CREATE POLICY "Users can update BOQ for assigned or owned works"
  ON estimate.boq
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
    -- User is assigned to the work
    EXISTS (
      SELECT 1 FROM estimate.work_assignments wa
      WHERE wa.work_id = boq.work_id
      AND wa.user_id = auth.uid()
    )
    OR
    -- User created the work
    EXISTS (
      SELECT 1 FROM estimate.works w
      WHERE w.works_id = boq.work_id
      AND w.created_by = auth.uid()
    )
    OR
    -- User generated this BOQ
    generated_by = auth.uid()
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
    EXISTS (
      SELECT 1 FROM estimate.work_assignments wa
      WHERE wa.work_id = boq.work_id
      AND wa.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM estimate.works w
      WHERE w.works_id = boq.work_id
      AND w.created_by = auth.uid()
    )
    OR
    generated_by = auth.uid()
  );

-- DELETE: Only admins can delete BOQ
CREATE POLICY "Admins can delete BOQ"
  ON estimate.boq
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
  );
