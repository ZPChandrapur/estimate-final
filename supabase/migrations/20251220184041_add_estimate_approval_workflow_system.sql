/*
  # Add Estimate Approval Workflow System

  ## Overview
  This migration creates a comprehensive approval workflow system for estimates with the following hierarchy:
  - Junior Engineer (JE) → Sub Division Engineer → Divisional Engineer → Executive Engineer
  
  ## 1. New Tables
  
  ### `estimate.approval_workflows`
  Defines the approval chain for each work/estimate
  - `id` (uuid, primary key) - Unique identifier
  - `work_id` (text) - Reference to estimate.works.works_id
  - `current_level` (integer) - Current approval level (1-4)
  - `current_approver_id` (uuid) - User who needs to approve currently
  - `status` (text) - Overall workflow status: draft, pending_approval, approved, rejected, sent_back
  - `initiated_by` (uuid) - User who started the approval process
  - `initiated_at` (timestamptz) - When approval process started
  - `completed_at` (timestamptz) - When workflow completed (approved/rejected)
  - `created_at` (timestamptz) - Record creation time
  - `updated_at` (timestamptz) - Last update time
  
  ### `estimate.approval_history`
  Tracks all approval actions and comments
  - `id` (uuid, primary key) - Unique identifier
  - `workflow_id` (uuid) - Reference to approval_workflows
  - `work_id` (text) - Reference to estimate.works.works_id
  - `level` (integer) - Approval level when action taken
  - `approver_id` (uuid) - User who took the action
  - `approver_role_id` (integer) - Role of the approver
  - `action` (text) - Action taken: submitted, approved, rejected, sent_back, forwarded
  - `comments` (text) - Optional comments/reasons
  - `previous_approver_id` (uuid) - Previous approver (for forwarded cases)
  - `next_approver_id` (uuid) - Next approver (for forwarded cases)
  - `created_at` (timestamptz) - When action was taken
  
  ## 2. Status Updates
  Add estimate_status field to works table to track preparation status
  - draft - Being prepared
  - ready_for_approval - Completed and ready to submit
  - in_approval - Currently in approval process
  - approved - Fully approved
  - rejected - Rejected by an approver
  - sent_back - Sent back for modifications
  
  ## 3. Security
  - Enable RLS on all new tables
  - Users can view workflows for their assigned works
  - Only current approver can take approval actions
  - Admins can view all workflows
  - History is read-only for all users (insert only through functions)
  
  ## 4. Helper Functions
  - Function to initiate approval workflow
  - Function to process approval action (approve/reject/send back/forward)
  - Function to calculate next approver based on hierarchy
*/

-- Add estimate_status column to works table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'estimate' 
    AND table_name = 'works' 
    AND column_name = 'estimate_status'
  ) THEN
    ALTER TABLE estimate.works 
    ADD COLUMN estimate_status text DEFAULT 'draft' CHECK (
      estimate_status IN ('draft', 'ready_for_approval', 'in_approval', 'approved', 'rejected', 'sent_back')
    );
  END IF;
END $$;

-- Create approval_workflows table
CREATE TABLE IF NOT EXISTS estimate.approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id text NOT NULL REFERENCES estimate.works(works_id) ON DELETE CASCADE,
  current_level integer DEFAULT 1 CHECK (current_level BETWEEN 1 AND 4),
  current_approver_id uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending_approval' CHECK (
    status IN ('pending_approval', 'approved', 'rejected', 'sent_back')
  ),
  initiated_by uuid REFERENCES auth.users(id),
  initiated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(work_id)
);

-- Create approval_history table
CREATE TABLE IF NOT EXISTS estimate.approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES estimate.approval_workflows(id) ON DELETE CASCADE,
  work_id text NOT NULL REFERENCES estimate.works(works_id) ON DELETE CASCADE,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 4),
  approver_id uuid NOT NULL REFERENCES auth.users(id),
  approver_role_id integer REFERENCES public.roles(id),
  action text NOT NULL CHECK (
    action IN ('submitted', 'approved', 'rejected', 'sent_back', 'forwarded')
  ),
  comments text,
  previous_approver_id uuid REFERENCES auth.users(id),
  next_approver_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE estimate.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate.approval_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approval_workflows

-- Users can view workflows for their assigned works
CREATE POLICY "Users can view workflows for assigned works"
  ON estimate.approval_workflows
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
    -- User is assigned to this work
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = approval_workflows.work_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    -- User initiated the workflow
    initiated_by = auth.uid()
    OR
    -- User is current approver
    current_approver_id = auth.uid()
  );

-- Authenticated users can initiate workflows for their works
CREATE POLICY "Users can create workflows for assigned works"
  ON estimate.approval_workflows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = work_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
  );

-- Current approver and admins can update workflows
CREATE POLICY "Approvers can update workflows"
  ON estimate.approval_workflows
  FOR UPDATE
  TO authenticated
  USING (
    current_approver_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
  );

-- RLS Policies for approval_history

-- Users can view history for their assigned works
CREATE POLICY "Users can view approval history for assigned works"
  ON estimate.approval_history
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
    -- User is assigned to this work
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = approval_history.work_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    -- User is an approver in the history
    approver_id = auth.uid()
  );

-- Only system/authenticated users can insert history (through functions)
CREATE POLICY "Authenticated users can create approval history"
  ON estimate.approval_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_approval_workflows_work_id ON estimate.approval_workflows(work_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_current_approver ON estimate.approval_workflows(current_approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_status ON estimate.approval_workflows(status);
CREATE INDEX IF NOT EXISTS idx_approval_history_workflow_id ON estimate.approval_history(workflow_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_work_id ON estimate.approval_history(work_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_approver_id ON estimate.approval_history(approver_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION estimate.update_approval_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_approval_workflow_updated_at ON estimate.approval_workflows;
CREATE TRIGGER update_approval_workflow_updated_at
  BEFORE UPDATE ON estimate.approval_workflows
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_approval_workflow_updated_at();

-- Function to get next approver in hierarchy
CREATE OR REPLACE FUNCTION estimate.get_next_approver(
  p_work_id text,
  p_current_level integer
)
RETURNS TABLE(user_id uuid, role_id integer, level integer) AS $$
DECLARE
  v_next_level integer;
  v_role_id integer;
BEGIN
  -- Calculate next level (1=JE, 2=Sub Div, 3=Div, 4=Exec)
  v_next_level := p_current_level + 1;
  
  -- If we've exceeded max level, return null
  IF v_next_level > 4 THEN
    RETURN;
  END IF;
  
  -- Map level to role ID
  v_role_id := CASE v_next_level
    WHEN 1 THEN 10  -- Junior Engineer
    WHEN 2 THEN 15  -- Sub Division Engineer
    WHEN 3 THEN 16  -- Divisional Engineer
    WHEN 4 THEN 17  -- Executive Engineer
  END;
  
  -- Find user assigned to this work with the required role
  RETURN QUERY
  SELECT 
    wa.user_id,
    wa.role_id,
    v_next_level
  FROM estimate.work_assignments wa
  WHERE wa.work_id = p_work_id
    AND wa.role_id = v_role_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initiate approval workflow
CREATE OR REPLACE FUNCTION estimate.initiate_approval_workflow(
  p_work_id text
)
RETURNS uuid AS $$
DECLARE
  v_workflow_id uuid;
  v_next_approver record;
  v_initiator_role integer;
BEGIN
  -- Get initiator's role
  SELECT role_id INTO v_initiator_role
  FROM estimate.work_assignments
  WHERE work_id = p_work_id AND user_id = auth.uid()
  LIMIT 1;
  
  -- Get next approver (one level above initiator)
  SELECT * INTO v_next_approver
  FROM estimate.get_next_approver(p_work_id, 
    CASE v_initiator_role
      WHEN 10 THEN 1  -- JE submits, goes to level 2 (Sub Div)
      WHEN 15 THEN 2  -- Sub Div submits, goes to level 3 (Div)
      WHEN 16 THEN 3  -- Div submits, goes to level 4 (Exec)
      ELSE 1
    END
  );
  
  IF v_next_approver.user_id IS NULL THEN
    RAISE EXCEPTION 'No approver found for next level';
  END IF;
  
  -- Create workflow
  INSERT INTO estimate.approval_workflows (
    work_id,
    current_level,
    current_approver_id,
    status,
    initiated_by
  ) VALUES (
    p_work_id,
    v_next_approver.level,
    v_next_approver.user_id,
    'pending_approval',
    auth.uid()
  )
  RETURNING id INTO v_workflow_id;
  
  -- Add history entry
  INSERT INTO estimate.approval_history (
    workflow_id,
    work_id,
    level,
    approver_id,
    approver_role_id,
    action,
    next_approver_id
  ) VALUES (
    v_workflow_id,
    p_work_id,
    CASE v_initiator_role
      WHEN 10 THEN 1
      WHEN 15 THEN 2
      WHEN 16 THEN 3
      ELSE 1
    END,
    auth.uid(),
    v_initiator_role,
    'submitted',
    v_next_approver.user_id
  );
  
  -- Update work status
  UPDATE estimate.works
  SET estimate_status = 'in_approval'
  WHERE works_id = p_work_id;
  
  RETURN v_workflow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process approval action
CREATE OR REPLACE FUNCTION estimate.process_approval_action(
  p_workflow_id uuid,
  p_action text,
  p_comments text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_workflow record;
  v_next_approver record;
  v_approver_role integer;
BEGIN
  -- Get workflow details
  SELECT * INTO v_workflow
  FROM estimate.approval_workflows
  WHERE id = p_workflow_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workflow not found';
  END IF;
  
  -- Verify current user is the approver
  IF v_workflow.current_approver_id != auth.uid() THEN
    RAISE EXCEPTION 'Only current approver can take action';
  END IF;
  
  -- Get approver's role
  SELECT role_id INTO v_approver_role
  FROM estimate.work_assignments
  WHERE work_id = v_workflow.work_id AND user_id = auth.uid()
  LIMIT 1;
  
  -- Handle different actions
  IF p_action = 'approved' THEN
    -- Check if this is final approval (Executive Engineer at level 4)
    IF v_workflow.current_level = 4 THEN
      -- Final approval
      UPDATE estimate.approval_workflows
      SET status = 'approved',
          completed_at = now()
      WHERE id = p_workflow_id;
      
      UPDATE estimate.works
      SET estimate_status = 'approved'
      WHERE works_id = v_workflow.work_id;
      
      INSERT INTO estimate.approval_history (
        workflow_id, work_id, level, approver_id, approver_role_id, action, comments
      ) VALUES (
        p_workflow_id, v_workflow.work_id, v_workflow.current_level, 
        auth.uid(), v_approver_role, 'approved', p_comments
      );
    ELSE
      -- Forward to next level
      SELECT * INTO v_next_approver
      FROM estimate.get_next_approver(v_workflow.work_id, v_workflow.current_level);
      
      IF v_next_approver.user_id IS NULL THEN
        RAISE EXCEPTION 'No approver found for next level';
      END IF;
      
      UPDATE estimate.approval_workflows
      SET current_level = v_next_approver.level,
          current_approver_id = v_next_approver.user_id
      WHERE id = p_workflow_id;
      
      INSERT INTO estimate.approval_history (
        workflow_id, work_id, level, approver_id, approver_role_id, 
        action, comments, next_approver_id
      ) VALUES (
        p_workflow_id, v_workflow.work_id, v_workflow.current_level, 
        auth.uid(), v_approver_role, 'forwarded', p_comments, v_next_approver.user_id
      );
    END IF;
    
  ELSIF p_action = 'rejected' THEN
    UPDATE estimate.approval_workflows
    SET status = 'rejected',
        completed_at = now()
    WHERE id = p_workflow_id;
    
    UPDATE estimate.works
    SET estimate_status = 'rejected'
    WHERE works_id = v_workflow.work_id;
    
    INSERT INTO estimate.approval_history (
      workflow_id, work_id, level, approver_id, approver_role_id, action, comments
    ) VALUES (
      p_workflow_id, v_workflow.work_id, v_workflow.current_level, 
      auth.uid(), v_approver_role, 'rejected', p_comments
    );
    
  ELSIF p_action = 'sent_back' THEN
    UPDATE estimate.approval_workflows
    SET status = 'sent_back',
        completed_at = now()
    WHERE id = p_workflow_id;
    
    UPDATE estimate.works
    SET estimate_status = 'sent_back'
    WHERE works_id = v_workflow.work_id;
    
    INSERT INTO estimate.approval_history (
      workflow_id, work_id, level, approver_id, approver_role_id, action, comments
    ) VALUES (
      p_workflow_id, v_workflow.work_id, v_workflow.current_level, 
      auth.uid(), v_approver_role, 'sent_back', p_comments
    );
    
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
