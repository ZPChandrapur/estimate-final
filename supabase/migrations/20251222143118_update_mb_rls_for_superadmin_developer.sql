/*
  # Update MB System RLS Policies for Super Admin and Developer Access

  ## Overview
  Grant full access to super_admin and developer roles across all MB system tables

  ## Changes
  - Drop and recreate RLS policies on mb_projects to include super_admin and developer
  - Drop and recreate RLS policies on mb_boq_items to include super_admin and developer
  - Drop and recreate RLS policies on mb_measurements to include super_admin and developer
  - Drop and recreate RLS policies on mb_approvals to include super_admin and developer
  - Drop and recreate RLS policies on mb_audit_logs to include super_admin and developer
  - Drop and recreate RLS policies on mb_reports to include super_admin and developer

  ## Security Notes
  - Super admins and developers get full CRUD access to all MB tables
  - Existing role-based restrictions remain for other roles
*/

-- =====================================================
-- 1. Update mb_projects policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view mb_projects" ON estimate.mb_projects;
DROP POLICY IF EXISTS "Authorized users can insert projects" ON estimate.mb_projects;
DROP POLICY IF EXISTS "Authorized users can update projects" ON estimate.mb_projects;

CREATE POLICY "Users can view mb_projects"
  ON estimate.mb_projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can insert projects"
  ON estimate.mb_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin', 'developer', 'mb_clerk', 'Executive Engineer')
    )
  );

CREATE POLICY "Authorized users can update projects"
  ON estimate.mb_projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin', 'developer', 'mb_clerk', 'Executive Engineer')
    )
  );

-- =====================================================
-- 2. Update mb_boq_items policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view boq items" ON estimate.mb_boq_items;
DROP POLICY IF EXISTS "Authorized users can manage boq items" ON estimate.mb_boq_items;

CREATE POLICY "Users can view boq items"
  ON estimate.mb_boq_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can manage boq items"
  ON estimate.mb_boq_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin', 'developer', 'mb_clerk', 'Executive Engineer')
    )
  );

-- =====================================================
-- 3. Update mb_measurements policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view measurements" ON estimate.mb_measurements;
DROP POLICY IF EXISTS "Contractors can insert measurements" ON estimate.mb_measurements;
DROP POLICY IF EXISTS "Contractors can update draft measurements" ON estimate.mb_measurements;
DROP POLICY IF EXISTS "Engineers can update measurement status" ON estimate.mb_measurements;

CREATE POLICY "Users can view measurements"
  ON estimate.mb_measurements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Contractors can insert measurements"
  ON estimate.mb_measurements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Contractor', 'admin', 'super_admin', 'developer', 'mb_clerk')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Contractors can update draft measurements"
  ON estimate.mb_measurements FOR UPDATE
  TO authenticated
  USING (
    (created_by = auth.uid() AND status = 'draft')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin', 'developer')
    )
  );

CREATE POLICY "Engineers can update measurement status"
  ON estimate.mb_measurements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Junior Engineer', 'Deputy Engineer', 'Executive Engineer', 'admin', 'super_admin', 'developer')
    )
  );

-- =====================================================
-- 4. Update mb_approvals policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view approvals" ON estimate.mb_approvals;
DROP POLICY IF EXISTS "Engineers can insert approvals" ON estimate.mb_approvals;

CREATE POLICY "Users can view approvals"
  ON estimate.mb_approvals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Engineers can insert approvals"
  ON estimate.mb_approvals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Junior Engineer', 'Deputy Engineer', 'Executive Engineer', 'admin', 'super_admin', 'developer')
    )
    AND approver_id = auth.uid()
  );

-- =====================================================
-- 5. Update mb_audit_logs policies
-- =====================================================

DROP POLICY IF EXISTS "Auditors can view audit logs" ON estimate.mb_audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON estimate.mb_audit_logs;

CREATE POLICY "Auditors can view audit logs"
  ON estimate.mb_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Auditor', 'admin', 'super_admin', 'developer', 'Executive Engineer')
    )
  );

CREATE POLICY "System can insert audit logs"
  ON estimate.mb_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 6. Update mb_reports policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view reports" ON estimate.mb_reports;
DROP POLICY IF EXISTS "Authorized users can generate reports" ON estimate.mb_reports;

CREATE POLICY "Users can view reports"
  ON estimate.mb_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can generate reports"
  ON estimate.mb_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Executive Engineer', 'Auditor', 'Accountant', 'admin', 'super_admin', 'developer')
    )
    AND generated_by = auth.uid()
  );
