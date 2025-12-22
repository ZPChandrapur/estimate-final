/*
  # Create MB Work Management System Tables

  ## Overview
  Comprehensive work management system for MB including work details, contractors, role assignments, and subworks

  ## New Tables
  - mb_work_details: Extended work information beyond basic project data
  - mb_contractors: Contractor registration and details
  - mb_work_role_assignments: Role assignments for works (Auditor, JE, JE Div, etc.)
  - mb_work_subworks: Subworks linked to MB projects

  ## Security
  - RLS enabled on all tables
  - Policies for super_admin, developer, admin, and authorized roles
*/

-- =====================================================
-- 1. Extend mb_projects with additional work fields
-- =====================================================

DO $$
BEGIN
  -- Add work detail columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'tender_no') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN tender_no text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'tender_submission_date') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN tender_submission_date date;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'tender_opening_date') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN tender_opening_date date;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'work_order_date') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN work_order_date date;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'work_duration_months') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN work_duration_months integer;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'work_duration_days') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN work_duration_days integer;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'work_end_date') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN work_end_date date;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'work_order_outward_no') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN work_order_outward_no text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'agreement_reference_no') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN agreement_reference_no text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'state') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN state text DEFAULT 'Maharashtra';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'city_location') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN city_location text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'region') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN region text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'tender_type') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN tender_type text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'type_of_work') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN type_of_work text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'select_programme') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN select_programme text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'select_scheme') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN select_scheme text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'consider_escalation') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN consider_escalation boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'cost_put_to_tender') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN cost_put_to_tender numeric(15, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'above_below_percentage') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN above_below_percentage numeric(10, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'above_below_percentage_cl38') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN above_below_percentage_cl38 numeric(10, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'quoted_amount') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN quoted_amount numeric(15, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'total_security_deposit') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN total_security_deposit numeric(15, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'initial_security_deposit') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN initial_security_deposit numeric(15, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'additional_security_deposit') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN additional_security_deposit numeric(15, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'cl38_amount') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN cl38_amount numeric(15, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'retention_money_deposit') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN retention_money_deposit text;
  END IF;
END $$;

-- =====================================================
-- 2. Create mb_contractors table
-- =====================================================

CREATE TABLE IF NOT EXISTS estimate.mb_contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES estimate.mb_projects(id) ON DELETE CASCADE NOT NULL,
  contractor_name text NOT NULL,
  pan_no text,
  contractor_type text,
  contractor_class text,
  contact_person_first_name text,
  contact_person_last_name text,
  mobile_no text,
  pin_code text,
  address text,
  city_location text,
  gst_no text,
  email text,
  business_type text,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE estimate.mb_contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contractors"
  ON estimate.mb_contractors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can manage contractors"
  ON estimate.mb_contractors FOR ALL
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
-- 3. Create mb_work_role_assignments table
-- =====================================================

CREATE TABLE IF NOT EXISTS estimate.mb_work_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES estimate.mb_projects(id) ON DELETE CASCADE NOT NULL,
  role_type text NOT NULL CHECK (role_type IN ('Auditor', 'JE', 'JE_Div', 'Deputy Engineer', 'Executive Engineer', 'Accountant')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assigned_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, role_type, user_id)
);

ALTER TABLE estimate.mb_work_role_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view role assignments"
  ON estimate.mb_work_role_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can manage role assignments"
  ON estimate.mb_work_role_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin', 'developer', 'Executive Engineer')
    )
  );

-- =====================================================
-- 4. Create mb_work_subworks table
-- =====================================================

CREATE TABLE IF NOT EXISTS estimate.mb_work_subworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES estimate.mb_projects(id) ON DELETE CASCADE NOT NULL,
  subworks_id text REFERENCES estimate.subworks(subworks_id) ON DELETE SET NULL,
  subwork_name text NOT NULL,
  subwork_description text,
  estimated_amount numeric(15, 2) DEFAULT 0,
  is_from_estimate boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE estimate.mb_work_subworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view work subworks"
  ON estimate.mb_work_subworks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can manage work subworks"
  ON estimate.mb_work_subworks FOR ALL
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
-- 5. Create Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_mb_contractors_project_id ON estimate.mb_contractors(project_id);
CREATE INDEX IF NOT EXISTS idx_mb_work_role_assignments_project_id ON estimate.mb_work_role_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_mb_work_role_assignments_user_id ON estimate.mb_work_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_mb_work_subworks_project_id ON estimate.mb_work_subworks(project_id);
CREATE INDEX IF NOT EXISTS idx_mb_work_subworks_subworks_id ON estimate.mb_work_subworks(subworks_id);

-- =====================================================
-- 6. Create Triggers
-- =====================================================

CREATE TRIGGER trg_mb_contractors_updated
  BEFORE UPDATE ON estimate.mb_contractors
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_mb_timestamp();

CREATE TRIGGER trg_mb_work_role_assignments_updated
  BEFORE UPDATE ON estimate.mb_work_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_mb_timestamp();

CREATE TRIGGER trg_mb_work_subworks_updated
  BEFORE UPDATE ON estimate.mb_work_subworks
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_mb_timestamp();
