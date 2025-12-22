/*
  # Create Measurement Book (MB) System - Complete Schema

  ## Overview
  Complete database schema for e-MB (electronic Measurement Book) system.

  ## New Roles
  - mb_clerk, Contractor, Junior Engineer, Deputy Engineer, Executive Engineer, Auditor, Accountant

  ## New Tables
  All MB-specific tables with RLS policies and indexes
*/

-- =====================================================
-- 1. Add New Roles (with explicit IDs starting from 18)
-- =====================================================

DO $$
DECLARE
  next_id integer := 18;
BEGIN
  -- MB Clerk
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'mb_clerk') THEN
    INSERT INTO public.roles (id, name, description, application)
    VALUES (next_id, 'mb_clerk', 'Measurement Book Clerk - Manages BOQ uploads and project setup', 'mb');
    next_id := next_id + 1;
  END IF;

  -- Contractor
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'Contractor') THEN
    INSERT INTO public.roles (id, name, description, application)
    VALUES (next_id, 'Contractor', 'Contractor - Enters measurements and submits for approval', 'mb');
    next_id := next_id + 1;
  END IF;

  -- Junior Engineer
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'Junior Engineer') THEN
    INSERT INTO public.roles (id, name, description, application)
    VALUES (next_id, 'Junior Engineer', 'Junior Engineer - Reviews and approves contractor submissions', 'mb');
    next_id := next_id + 1;
  END IF;

  -- Deputy Engineer
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'Deputy Engineer') THEN
    INSERT INTO public.roles (id, name, description, application)
    VALUES (next_id, 'Deputy Engineer', 'Deputy Engineer - Verifies JE approvals', 'mb');
    next_id := next_id + 1;
  END IF;

  -- Executive Engineer
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'Executive Engineer') THEN
    INSERT INTO public.roles (id, name, description, application)
    VALUES (next_id, 'Executive Engineer', 'Executive Engineer - Final approval and MB finalization', 'mb');
    next_id := next_id + 1;
  END IF;

  -- Auditor
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'Auditor') THEN
    INSERT INTO public.roles (id, name, description, application)
    VALUES (next_id, 'Auditor', 'Auditor - Views audit logs and reports', 'mb');
    next_id := next_id + 1;
  END IF;

  -- Accountant
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'Accountant') THEN
    INSERT INTO public.roles (id, name, description, application)
    VALUES (next_id, 'Accountant', 'Accountant - Accesses financial reports', 'mb');
  END IF;
END $$;

-- =====================================================
-- 2. Create MB Projects Table
-- =====================================================

CREATE TABLE IF NOT EXISTS estimate.mb_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text UNIQUE NOT NULL,
  project_name text NOT NULL,
  description text,
  works_id text REFERENCES estimate.works(works_id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
  start_date date NOT NULL,
  end_date date,
  total_boq_amount numeric(15, 2) DEFAULT 0,
  total_executed_amount numeric(15, 2) DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE estimate.mb_projects ENABLE ROW LEVEL SECURITY;

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
      AND r.name IN ('admin', 'mb_clerk', 'Executive Engineer')
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
      AND r.name IN ('admin', 'mb_clerk', 'Executive Engineer')
    )
  );

-- =====================================================
-- 3. Create MB BOQ Items Table
-- =====================================================

CREATE TABLE IF NOT EXISTS estimate.mb_boq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES estimate.mb_projects(id) ON DELETE CASCADE NOT NULL,
  item_number text NOT NULL,
  description text NOT NULL,
  unit text NOT NULL,
  boq_quantity numeric(15, 3) NOT NULL CHECK (boq_quantity > 0),
  rate numeric(15, 2) NOT NULL CHECK (rate > 0),
  amount numeric(15, 2) GENERATED ALWAYS AS (boq_quantity * rate) STORED,
  executed_quantity numeric(15, 3) DEFAULT 0 CHECK (executed_quantity >= 0),
  balance_quantity numeric(15, 3) GENERATED ALWAYS AS (boq_quantity - executed_quantity) STORED,
  executed_amount numeric(15, 2) DEFAULT 0,
  remarks text,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, item_number)
);

ALTER TABLE estimate.mb_boq_items ENABLE ROW LEVEL SECURITY;

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
      AND r.name IN ('admin', 'mb_clerk', 'Executive Engineer')
    )
  );

-- =====================================================
-- 4. Create MB Measurements Table
-- =====================================================

CREATE TABLE IF NOT EXISTS estimate.mb_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES estimate.mb_projects(id) ON DELETE CASCADE NOT NULL,
  boq_item_id uuid REFERENCES estimate.mb_boq_items(id) ON DELETE CASCADE NOT NULL,
  measurement_number text NOT NULL,
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  length numeric(15, 3),
  breadth numeric(15, 3),
  height numeric(15, 3),
  quantity numeric(15, 3) NOT NULL CHECK (quantity > 0),
  rate numeric(15, 2) NOT NULL,
  amount numeric(15, 2) GENERATED ALWAYS AS (quantity * rate) STORED,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'je_approved', 'de_approved', 'ee_approved', 'rejected')),
  remarks text,
  rejection_reason text,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE estimate.mb_measurements ENABLE ROW LEVEL SECURITY;

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
      AND r.name IN ('Contractor', 'admin', 'mb_clerk')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Contractors can update draft measurements"
  ON estimate.mb_measurements FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() AND status = 'draft'
  );

CREATE POLICY "Engineers can update measurement status"
  ON estimate.mb_measurements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Junior Engineer', 'Deputy Engineer', 'Executive Engineer', 'admin')
    )
  );

-- =====================================================
-- 5. Create MB Approvals Table
-- =====================================================

CREATE TABLE IF NOT EXISTS estimate.mb_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid REFERENCES estimate.mb_measurements(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES estimate.mb_projects(id) ON DELETE CASCADE NOT NULL,
  approver_role text NOT NULL CHECK (approver_role IN ('Junior Engineer', 'Deputy Engineer', 'Executive Engineer')),
  approver_id uuid REFERENCES auth.users(id) NOT NULL,
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'returned')),
  remarks text,
  approved_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE estimate.mb_approvals ENABLE ROW LEVEL SECURITY;

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
      AND r.name IN ('Junior Engineer', 'Deputy Engineer', 'Executive Engineer', 'admin')
    )
    AND approver_id = auth.uid()
  );

-- =====================================================
-- 6. Create MB Audit Logs Table
-- =====================================================

CREATE TABLE IF NOT EXISTS estimate.mb_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES estimate.mb_projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('project', 'boq', 'measurement', 'approval', 'report')),
  entity_id uuid,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE estimate.mb_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auditors can view audit logs"
  ON estimate.mb_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Auditor', 'admin', 'Executive Engineer')
    )
  );

CREATE POLICY "System can insert audit logs"
  ON estimate.mb_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 7. Create MB Notifications Table
-- =====================================================

CREATE TABLE IF NOT EXISTS estimate.mb_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES estimate.mb_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
  related_entity_type text CHECK (related_entity_type IN ('project', 'boq', 'measurement', 'approval')),
  related_entity_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE estimate.mb_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
  ON estimate.mb_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON estimate.mb_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their notifications"
  ON estimate.mb_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- 8. Create MB Reports Table
-- =====================================================

CREATE TABLE IF NOT EXISTS estimate.mb_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES estimate.mb_projects(id) ON DELETE CASCADE NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('mb_summary', 'boq_progress', 'audit_trail', 'financial_summary')),
  report_name text NOT NULL,
  file_path text,
  generated_by uuid REFERENCES auth.users(id) NOT NULL,
  parameters jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE estimate.mb_reports ENABLE ROW LEVEL SECURITY;

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
      AND r.name IN ('Executive Engineer', 'Auditor', 'Accountant', 'admin')
    )
    AND generated_by = auth.uid()
  );

-- =====================================================
-- 9. Create Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_mb_projects_status ON estimate.mb_projects(status);
CREATE INDEX IF NOT EXISTS idx_mb_projects_works_id ON estimate.mb_projects(works_id);
CREATE INDEX IF NOT EXISTS idx_mb_boq_items_project_id ON estimate.mb_boq_items(project_id);
CREATE INDEX IF NOT EXISTS idx_mb_measurements_project_id ON estimate.mb_measurements(project_id);
CREATE INDEX IF NOT EXISTS idx_mb_measurements_status ON estimate.mb_measurements(status);
CREATE INDEX IF NOT EXISTS idx_mb_approvals_measurement_id ON estimate.mb_approvals(measurement_id);
CREATE INDEX IF NOT EXISTS idx_mb_audit_logs_project_id ON estimate.mb_audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_mb_notifications_user_id ON estimate.mb_notifications(user_id);

-- =====================================================
-- 10. Create Triggers
-- =====================================================

CREATE OR REPLACE FUNCTION estimate.update_mb_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mb_projects_updated
  BEFORE UPDATE ON estimate.mb_projects
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_mb_timestamp();

CREATE TRIGGER trg_mb_boq_items_updated
  BEFORE UPDATE ON estimate.mb_boq_items
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_mb_timestamp();

CREATE TRIGGER trg_mb_measurements_updated
  BEFORE UPDATE ON estimate.mb_measurements
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_mb_timestamp();
