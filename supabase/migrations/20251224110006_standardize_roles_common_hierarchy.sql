/*
  # Standardize Roles for Estimate and MB Systems

  ## Overview
  This migration standardizes roles across Estimate and MB systems with a common hierarchy.

  ## Approval Flows
  - **Estimate**: JE → SDE → DJE → DE → EE
  - **MB**: mb_clerk → Contractor → JE → SDE → Auditor → DJE → Accountant → DE → EE

  ## New Standardized Roles (Common for both systems)
  1. Junior Engineer (JE)
  2. Sub Division Engineer (SDE)
  3. Divisional Junior Engineer (DJE)
  4. Divisional Engineer (DE)
  5. Executive Engineer (EE)
  6. mb_clerk (MB only)
  7. Contractor (MB only)
  8. Auditor (MB only)
  9. Accountant (MB only)

  ## Changes
  - Update existing role names to match new standard
  - Add missing roles (DJE)
  - Migrate old role references to new standardized roles
  - Update all RLS policies to use new role names
  - Keep developer, super_admin, and admin access unchanged
*/

-- =====================================================
-- 1. Update Existing Roles to New Standard Names
-- =====================================================

-- Update "Junior Engineer (JE)" to standard name (id 10)
UPDATE public.roles 
SET name = 'Junior Engineer (JE)',
    description = 'Junior Engineer - Reviews and approves submissions',
    application = 'estimate,mb'
WHERE id = 10;

-- Update "Sub Division Engineer" to standard name (id 15)
UPDATE public.roles 
SET name = 'Sub Division Engineer (SDE)',
    description = 'Sub Division Engineer - Reviews JE approvals',
    application = 'estimate,mb'
WHERE id = 15;

-- Update "Divisional Engineer" to standard name (id 16)
UPDATE public.roles 
SET name = 'Divisional Engineer (DE)',
    description = 'Divisional Engineer - Reviews DJE approvals',
    application = 'estimate,mb'
WHERE id = 16;

-- Update "Executive Engineer" to standard name (id 17)
UPDATE public.roles 
SET name = 'Executive Engineer (EE)',
    description = 'Executive Engineer - Final approval authority',
    application = 'estimate,mb'
WHERE id = 17;

-- Update mb_clerk (id 18)
UPDATE public.roles 
SET description = 'MB Clerk - Manages BOQ uploads and project setup',
    application = 'mb'
WHERE id = 18;

-- Update Contractor (id 19)
UPDATE public.roles 
SET description = 'Contractor - Enters measurements and submits for approval',
    application = 'mb'
WHERE id = 19;

-- Update Auditor (id 22)
UPDATE public.roles 
SET description = 'Auditor - Reviews audit logs and reports',
    application = 'mb'
WHERE id = 22;

-- Update Accountant (id 23)
UPDATE public.roles 
SET description = 'Accountant - Reviews financial reports',
    application = 'mb'
WHERE id = 23;

-- =====================================================
-- 2. Add Missing Role: Divisional Junior Engineer (DJE)
-- =====================================================

DO $$
DECLARE
  next_role_id INTEGER;
  dje_role_id INTEGER;
BEGIN
  -- Check if DJE role already exists
  SELECT id INTO dje_role_id FROM public.roles WHERE name = 'Divisional Junior Engineer (DJE)';
  
  IF dje_role_id IS NULL THEN
    -- Get next available ID
    SELECT COALESCE(MAX(id), 0) + 1 INTO next_role_id FROM public.roles;
    
    INSERT INTO public.roles (id, name, description, application)
    VALUES (
      next_role_id,
      'Divisional Junior Engineer (DJE)',
      'Divisional Junior Engineer - Reviews SDE approvals',
      'estimate,mb'
    );
    
    dje_role_id := next_role_id;
  END IF;
END $$;

-- =====================================================
-- 3. Migrate Old Role References to New Standardized Roles
-- =====================================================

-- Migrate "Junior Engineer" (id 20) references to "Junior Engineer (JE)" (id 10)
UPDATE public.user_roles 
SET role_id = 10 
WHERE role_id = 20;

UPDATE estimate.approval_history 
SET approver_role_id = 10 
WHERE approver_role_id = 20;

UPDATE estimate.mb_project_assignments 
SET role_id = 10 
WHERE role_id = 20;

UPDATE estimate.work_assignments 
SET role_id = 10 
WHERE role_id = 20;

UPDATE public.application_permissions 
SET role_id = 10 
WHERE role_id = 20;

-- Migrate "Deputy Engineer" (id 21) references to "Sub Division Engineer (SDE)" (id 15)
UPDATE public.user_roles 
SET role_id = 15 
WHERE role_id = 21;

UPDATE estimate.approval_history 
SET approver_role_id = 15 
WHERE approver_role_id = 21;

UPDATE estimate.mb_project_assignments 
SET role_id = 15 
WHERE role_id = 21;

UPDATE estimate.work_assignments 
SET role_id = 15 
WHERE role_id = 21;

UPDATE public.application_permissions 
SET role_id = 15 
WHERE role_id = 21;

-- Migrate obsolete roles (id 24, 25) to appropriate new roles
UPDATE public.user_roles 
SET role_id = 10 
WHERE role_id IN (24, 25);

UPDATE estimate.approval_history 
SET approver_role_id = 10 
WHERE approver_role_id IN (24, 25);

UPDATE estimate.mb_project_assignments 
SET role_id = 10 
WHERE role_id IN (24, 25);

UPDATE estimate.work_assignments 
SET role_id = 10 
WHERE role_id IN (24, 25);

UPDATE public.application_permissions 
SET role_id = 10 
WHERE role_id IN (24, 25);

-- =====================================================
-- 4. Delete Obsolete Roles (Now Safe After Migration)
-- =====================================================

DELETE FROM public.roles WHERE id IN (20, 21, 24, 25);

-- =====================================================
-- 5. Update MB Measurement Policies
-- =====================================================

DROP POLICY IF EXISTS "Contractors can insert measurements" ON estimate.mb_measurements;
DROP POLICY IF EXISTS "Contractors can update draft measurements" ON estimate.mb_measurements;
DROP POLICY IF EXISTS "Engineers can update measurement status" ON estimate.mb_measurements;

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
      AND r.name IN (
        'Junior Engineer (JE)',
        'Sub Division Engineer (SDE)',
        'Divisional Junior Engineer (DJE)',
        'Divisional Engineer (DE)',
        'Executive Engineer (EE)',
        'admin',
        'super_admin',
        'developer'
      )
    )
  );

-- =====================================================
-- 6. Update MB Approval Policies
-- =====================================================

DROP POLICY IF EXISTS "Engineers can insert approvals" ON estimate.mb_approvals;

CREATE POLICY "Engineers can insert approvals"
  ON estimate.mb_approvals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN (
        'Junior Engineer (JE)',
        'Sub Division Engineer (SDE)',
        'Divisional Junior Engineer (DJE)',
        'Divisional Engineer (DE)',
        'Executive Engineer (EE)',
        'Auditor',
        'Accountant',
        'admin',
        'super_admin',
        'developer'
      )
    )
  );

-- =====================================================
-- 7. Update MB Projects and BOQ Policies
-- =====================================================

DROP POLICY IF EXISTS "Authorized users can insert projects" ON estimate.mb_projects;

CREATE POLICY "Authorized users can insert projects"
  ON estimate.mb_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('mb_clerk', 'admin', 'super_admin', 'developer')
    )
  );

DROP POLICY IF EXISTS "Authorized users can insert boq items" ON estimate.mb_boq_items;

CREATE POLICY "Authorized users can insert boq items"
  ON estimate.mb_boq_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('mb_clerk', 'Contractor', 'admin', 'super_admin', 'developer')
    )
  );
