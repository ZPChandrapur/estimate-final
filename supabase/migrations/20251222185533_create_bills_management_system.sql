/*
  # Create Bills Management System

  1. New Tables
    - `mb_bills`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to mb_projects)
      - `bill_number` (text, unique per project)
      - `bill_date` (date)
      - `bill_type` (text: 'RA' for Running Account)
      - `status` (text: draft, submitted, approved)
      - `total_amount` (decimal)
      - `previous_bill_amount` (decimal)
      - `current_bill_amount` (decimal)
      - `created_by` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `mb_bill_items`
      - `id` (uuid, primary key)
      - `bill_id` (uuid, foreign key to mb_bills)
      - `boq_item_id` (uuid, foreign key to mb_boq_items)
      - `measurement_ids` (uuid array, references to mb_measurements)
      - `total_qty_till_now` (decimal)
      - `prev_qty_upto_previous_bill` (decimal)
      - `qty_now_to_be_paid` (decimal)
      - `rate` (decimal)
      - `bill_rate` (decimal)
      - `amount` (decimal)
      - `is_clause_38` (boolean, for clause 38 items)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users with proper role checks
*/

-- Create mb_bills table
CREATE TABLE IF NOT EXISTS estimate.mb_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES estimate.mb_projects(id) ON DELETE CASCADE,
  bill_number text NOT NULL,
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  bill_type text NOT NULL DEFAULT 'RA',
  status text NOT NULL DEFAULT 'draft',
  total_amount decimal(15,2) NOT NULL DEFAULT 0,
  previous_bill_amount decimal(15,2) NOT NULL DEFAULT 0,
  current_bill_amount decimal(15,2) NOT NULL DEFAULT 0,
  remarks text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, bill_number)
);

-- Create mb_bill_items table
CREATE TABLE IF NOT EXISTS estimate.mb_bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES estimate.mb_bills(id) ON DELETE CASCADE,
  boq_item_id uuid NOT NULL REFERENCES estimate.mb_boq_items(id),
  measurement_ids uuid[] NOT NULL DEFAULT '{}',
  total_qty_till_now decimal(15,3) NOT NULL DEFAULT 0,
  prev_qty_upto_previous_bill decimal(15,3) NOT NULL DEFAULT 0,
  qty_now_to_be_paid decimal(15,3) NOT NULL DEFAULT 0,
  rate decimal(15,2) NOT NULL DEFAULT 0,
  bill_rate decimal(15,2) NOT NULL DEFAULT 0,
  amount decimal(15,2) NOT NULL DEFAULT 0,
  is_clause_38 boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE estimate.mb_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate.mb_bill_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mb_bills

-- Super admin and developer can do everything
CREATE POLICY "Super admin and developer full access to bills"
  ON estimate.mb_bills
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'developer')
    )
  );

-- Users can view bills
CREATE POLICY "Users can view bills"
  ON estimate.mb_bills
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 
                     'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 
                     'Executive Engineer', 'Auditor', 'Accountant', 'admin')
    )
  );

-- Authorized users can create bills
CREATE POLICY "Authorized users can create bills"
  ON estimate.mb_bills
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 
                     'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 
                     'Executive Engineer', 'admin', 'super_admin', 'developer')
    )
  );

-- Authorized users can update bills
CREATE POLICY "Authorized users can update bills"
  ON estimate.mb_bills
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 
                     'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 
                     'Executive Engineer', 'admin', 'super_admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 
                     'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 
                     'Executive Engineer', 'admin', 'super_admin', 'developer')
    )
  );

-- RLS Policies for mb_bill_items

-- Super admin and developer can do everything
CREATE POLICY "Super admin and developer full access to bill items"
  ON estimate.mb_bill_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'developer')
    )
  );

-- Users can view bill items
CREATE POLICY "Users can view bill items"
  ON estimate.mb_bill_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 
                     'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 
                     'Executive Engineer', 'Auditor', 'Accountant', 'admin')
    )
  );

-- Authorized users can insert bill items
CREATE POLICY "Authorized users can insert bill items"
  ON estimate.mb_bill_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 
                     'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 
                     'Executive Engineer', 'admin', 'super_admin', 'developer')
    )
  );

-- Authorized users can update bill items
CREATE POLICY "Authorized users can update bill items"
  ON estimate.mb_bill_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 
                     'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 
                     'Executive Engineer', 'admin', 'super_admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 
                     'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 
                     'Executive Engineer', 'admin', 'super_admin', 'developer')
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_mb_bills_project_id ON estimate.mb_bills(project_id);
CREATE INDEX IF NOT EXISTS idx_mb_bills_status ON estimate.mb_bills(status);
CREATE INDEX IF NOT EXISTS idx_mb_bill_items_bill_id ON estimate.mb_bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_mb_bill_items_boq_item_id ON estimate.mb_bill_items(boq_item_id);
