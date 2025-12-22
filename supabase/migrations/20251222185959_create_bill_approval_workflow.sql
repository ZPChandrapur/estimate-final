/*
  # Create Bill Approval Workflow System

  1. New Tables
    - `mb_bill_approvals`
      - Tracks approval workflow for each bill
      - Current status and approver information
      - Approval chain management
    
    - `mb_bill_approval_history`
      - Detailed history of all approval actions
      - Action log with timestamps
      - Comments and status changes

  2. Changes
    - Update mb_bills table to add approval-related fields
    - Add approval level tracking
    - Add WDMM amount field

  3. Security
    - Enable RLS on new tables
    - Add policies for role-based access
*/

-- Add new fields to mb_bills table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'estimate' 
    AND table_name = 'mb_bills' 
    AND column_name = 'wdmm_amount'
  ) THEN
    ALTER TABLE estimate.mb_bills ADD COLUMN wdmm_amount decimal(15,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'estimate' 
    AND table_name = 'mb_bills' 
    AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE estimate.mb_bills ADD COLUMN approval_status text DEFAULT 'draft'
      CHECK (approval_status IN ('draft', 'submitted', 'je_checked', 'de_checked', 
                                   'auditor_checked', 'jed_checked', 'account_checked', 
                                   'dee_checked', 'ee_approved', 'sent_back', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'estimate' 
    AND table_name = 'mb_bills' 
    AND column_name = 'current_approver_id'
  ) THEN
    ALTER TABLE estimate.mb_bills ADD COLUMN current_approver_id uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'estimate' 
    AND table_name = 'mb_bills' 
    AND column_name = 'current_approval_level'
  ) THEN
    ALTER TABLE estimate.mb_bills ADD COLUMN current_approval_level integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'estimate' 
    AND table_name = 'mb_bills' 
    AND column_name = 'no_of_mb_entries'
  ) THEN
    ALTER TABLE estimate.mb_bills ADD COLUMN no_of_mb_entries integer DEFAULT 0;
  END IF;
END $$;

-- Create mb_bill_approvals table
CREATE TABLE IF NOT EXISTS estimate.mb_bill_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES estimate.mb_bills(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES estimate.mb_projects(id),
  approval_level integer NOT NULL DEFAULT 1,
  approver_role text NOT NULL CHECK (approver_role IN ('Contractor', 'JE', 'DE', 'Auditor', 'JE(D)', 'Account', 'DEE', 'EE')),
  approver_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sent_back')),
  action_date timestamptz,
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(bill_id, approval_level)
);

-- Create mb_bill_approval_history table
CREATE TABLE IF NOT EXISTS estimate.mb_bill_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES estimate.mb_bills(id) ON DELETE CASCADE,
  approval_id uuid REFERENCES estimate.mb_bill_approvals(id),
  action_type text NOT NULL CHECK (action_type IN ('submitted', 'checked', 'approved', 'sent_back', 'rejected', 'corrected')),
  action_by_role text NOT NULL,
  action_by_id uuid NOT NULL REFERENCES auth.users(id),
  action_date timestamptz DEFAULT now(),
  status_name text NOT NULL,
  amount decimal(15,2),
  percentage_check decimal(5,2),
  no_of_entries integer,
  comments text,
  days_taken integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE estimate.mb_bill_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate.mb_bill_approval_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mb_bill_approvals

-- Super admin and developer full access
CREATE POLICY "Super admin and developer full access to bill approvals"
  ON estimate.mb_bill_approvals
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

-- Users can view bill approvals
CREATE POLICY "Users can view bill approvals"
  ON estimate.mb_bill_approvals
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

-- Authorized users can manage bill approvals
CREATE POLICY "Authorized users can manage bill approvals"
  ON estimate.mb_bill_approvals
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 
                     'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 
                     'Executive Engineer', 'Auditor', 'Accountant', 'admin', 
                     'super_admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 
                     'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 
                     'Executive Engineer', 'Auditor', 'Accountant', 'admin', 
                     'super_admin', 'developer')
    )
  );

-- RLS Policies for mb_bill_approval_history

-- Super admin and developer full access
CREATE POLICY "Super admin and developer full access to bill history"
  ON estimate.mb_bill_approval_history
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

-- Users can view bill approval history
CREATE POLICY "Users can view bill approval history"
  ON estimate.mb_bill_approval_history
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

-- Authorized users can add to history
CREATE POLICY "Authorized users can add to bill history"
  ON estimate.mb_bill_approval_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 
                     'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 
                     'Executive Engineer', 'Auditor', 'Accountant', 'admin', 
                     'super_admin', 'developer')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bill_approvals_bill_id ON estimate.mb_bill_approvals(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_approvals_status ON estimate.mb_bill_approvals(status);
CREATE INDEX IF NOT EXISTS idx_bill_approval_history_bill_id ON estimate.mb_bill_approval_history(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_approval_history_action_date ON estimate.mb_bill_approval_history(action_date DESC);

-- Create function to initiate bill approval workflow
CREATE OR REPLACE FUNCTION estimate.initiate_bill_approval(
  p_bill_id uuid,
  p_project_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_contractor_id uuid;
BEGIN
  -- Get contractor for the project
  SELECT created_by INTO v_contractor_id
  FROM estimate.mb_projects
  WHERE id = p_project_id;

  -- Create approval chain
  INSERT INTO estimate.mb_bill_approvals (bill_id, project_id, approval_level, approver_role, status)
  VALUES 
    (p_bill_id, p_project_id, 1, 'Contractor', 'approved'),
    (p_bill_id, p_project_id, 2, 'JE', 'pending'),
    (p_bill_id, p_project_id, 3, 'DE', 'pending'),
    (p_bill_id, p_project_id, 4, 'Auditor', 'pending'),
    (p_bill_id, p_project_id, 5, 'JE(D)', 'pending'),
    (p_bill_id, p_project_id, 6, 'Account', 'pending'),
    (p_bill_id, p_project_id, 7, 'DEE', 'pending'),
    (p_bill_id, p_project_id, 8, 'EE', 'pending');

  -- Update bill status
  UPDATE estimate.mb_bills
  SET 
    approval_status = 'submitted',
    current_approval_level = 1,
    status = 'submitted'
  WHERE id = p_bill_id;

  -- Add to history
  INSERT INTO estimate.mb_bill_approval_history (
    bill_id, action_type, action_by_role, action_by_id, status_name, action_date
  ) VALUES (
    p_bill_id, 'submitted', 'Contractor', auth.uid(), 'Bill Submitted By Contractor', now()
  );

  v_result := jsonb_build_object('success', true, 'message', 'Bill approval workflow initiated');
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object('success', false, 'error', SQLERRM);
    RETURN v_result;
END;
$$;

-- Create function to process bill approval action
CREATE OR REPLACE FUNCTION estimate.process_bill_approval(
  p_bill_id uuid,
  p_approval_level integer,
  p_action text,
  p_comments text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_current_role text;
  v_next_status text;
  v_amount decimal(15,2);
  v_entries integer;
BEGIN
  -- Get current approval role
  SELECT approver_role INTO v_current_role
  FROM estimate.mb_bill_approvals
  WHERE bill_id = p_bill_id AND approval_level = p_approval_level;

  -- Get bill details
  SELECT current_bill_amount, no_of_mb_entries INTO v_amount, v_entries
  FROM estimate.mb_bills
  WHERE id = p_bill_id;

  -- Determine next status
  CASE p_action
    WHEN 'approve' THEN
      -- Update current level approval
      UPDATE estimate.mb_bill_approvals
      SET 
        status = 'approved',
        approver_id = auth.uid(),
        action_date = now()
      WHERE bill_id = p_bill_id AND approval_level = p_approval_level;

      -- Set next status based on level
      v_next_status := CASE p_approval_level
        WHEN 2 THEN 'je_checked'
        WHEN 3 THEN 'de_checked'
        WHEN 4 THEN 'auditor_checked'
        WHEN 5 THEN 'jed_checked'
        WHEN 6 THEN 'account_checked'
        WHEN 7 THEN 'dee_checked'
        WHEN 8 THEN 'ee_approved'
        ELSE 'submitted'
      END;

      -- Update bill
      UPDATE estimate.mb_bills
      SET 
        approval_status = v_next_status,
        current_approval_level = p_approval_level,
        current_approver_id = auth.uid()
      WHERE id = p_bill_id;

      -- Add to history
      INSERT INTO estimate.mb_bill_approval_history (
        bill_id, action_type, action_by_role, action_by_id, 
        status_name, amount, no_of_entries, percentage_check, comments
      ) VALUES (
        p_bill_id, 'checked', v_current_role, auth.uid(),
        'MB Checked By ' || v_current_role, v_amount, v_entries, 100.00, p_comments
      );

    WHEN 'send_back' THEN
      UPDATE estimate.mb_bill_approvals
      SET 
        status = 'sent_back',
        approver_id = auth.uid(),
        action_date = now(),
        comments = p_comments
      WHERE bill_id = p_bill_id AND approval_level = p_approval_level;

      UPDATE estimate.mb_bills
      SET approval_status = 'sent_back'
      WHERE id = p_bill_id;

      INSERT INTO estimate.mb_bill_approval_history (
        bill_id, action_type, action_by_role, action_by_id, 
        status_name, comments
      ) VALUES (
        p_bill_id, 'sent_back', v_current_role, auth.uid(),
        'MB Send Back By ' || v_current_role, p_comments
      );

    WHEN 'reject' THEN
      UPDATE estimate.mb_bill_approvals
      SET 
        status = 'rejected',
        approver_id = auth.uid(),
        action_date = now(),
        comments = p_comments
      WHERE bill_id = p_bill_id AND approval_level = p_approval_level;

      UPDATE estimate.mb_bills
      SET approval_status = 'rejected'
      WHERE id = p_bill_id;

      INSERT INTO estimate.mb_bill_approval_history (
        bill_id, action_type, action_by_role, action_by_id, 
        status_name, comments
      ) VALUES (
        p_bill_id, 'rejected', v_current_role, auth.uid(),
        'MB Rejected By ' || v_current_role, p_comments
      );
  END CASE;

  v_result := jsonb_build_object('success', true, 'message', 'Action processed successfully');
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object('success', false, 'error', SQLERRM);
    RETURN v_result;
END;
$$;
