/*
  # Support Separate TA and TS Approval Workflows
  
  ## Problem
  - approval_workflows has UNIQUE constraint on work_id only
  - When promoting TA → TS, old workflow was deleted, losing audit trail
  - Cannot have both TA and TS workflows for the same work
  
  ## Solution
  - Add work_type column to approval_workflows
  - Change UNIQUE constraint to UNIQUE(work_id, work_type)
  - Now each work can have separate workflows for TA and TS
  - Preserves complete audit trail
  
  ## Changes
  1. Add work_type column (default 'TA' for backward compatibility)
  2. Migrate existing data to have work_type
  3. Update UNIQUE constraint
  4. Update RPC functions to handle work_type
*/

-- Add work_type column to approval_workflows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'estimate' 
    AND table_name = 'approval_workflows' 
    AND column_name = 'work_type'
  ) THEN
    ALTER TABLE estimate.approval_workflows 
    ADD COLUMN work_type text DEFAULT 'TA' CHECK (work_type IN ('TA', 'TS'));
  END IF;
END $$;

-- Ensure all existing workflows have work_type set to 'TA' (default for backward compatibility)
UPDATE estimate.approval_workflows 
SET work_type = 'TA' 
WHERE work_type IS NULL;

-- Drop old UNIQUE constraint
DO $$
BEGIN
  ALTER TABLE estimate.approval_workflows 
  DROP CONSTRAINT IF EXISTS approval_workflows_work_id_key;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Add new UNIQUE constraint that allows both TA and TS per work
ALTER TABLE estimate.approval_workflows 
ADD UNIQUE(work_id, work_type);

-- Fix approval_history CHECK constraint to include 'approved_final'
DO $$
BEGIN
  -- Drop old constraint if it exists
  ALTER TABLE estimate.approval_history
  DROP CONSTRAINT IF EXISTS approval_history_action_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Add updated constraint with 'approved_final'
ALTER TABLE estimate.approval_history
ADD CONSTRAINT approval_history_action_check CHECK (
  action IN ('submitted', 'approved', 'approved_final', 'rejected', 'sent_back', 'forwarded')
);

-- Update RPC function: initiate_approval_workflow to handle work_type
CREATE OR REPLACE FUNCTION estimate.initiate_approval_workflow(
  p_work_id text,
  p_work_type text DEFAULT 'TA'
)
RETURNS uuid AS $$
DECLARE
  v_workflow_id uuid;
  v_next_approver record;
  v_initiator_role integer;
  v_current_level integer;
  v_existing_status text;
BEGIN
  -- Block re-submission if workflow is still active for this work_type
  SELECT status INTO v_existing_status
  FROM estimate.approval_workflows
  WHERE work_id = p_work_id AND work_type = p_work_type;

  IF v_existing_status = 'pending_approval' THEN
    RAISE EXCEPTION 'This work already has an active approval workflow in progress.';
  END IF;

  IF v_existing_status = 'approved' THEN
    RAISE EXCEPTION 'This work has already been fully approved.';
  END IF;

  -- Get initiator's role
  SELECT role_id INTO v_initiator_role
  FROM estimate.work_assignments
  WHERE work_id = p_work_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_initiator_role IS NULL THEN
    RAISE EXCEPTION 'You are not assigned to this work. Please contact an administrator to assign you to this work before submitting for approval.';
  END IF;

  -- Calculate starting level based on initiator's role
  v_current_level := CASE v_initiator_role
    WHEN 10 THEN 1  -- JE submits, goes to level 2 (Sub Div)
    WHEN 15 THEN 2  -- Sub Div submits, goes to level 3 (Div)
    WHEN 16 THEN 3  -- Div submits, goes to level 4 (Exec)
    ELSE 1
  END;

  -- Get next approver (one level above initiator)
  SELECT * INTO v_next_approver
  FROM estimate.get_next_approver(p_work_id, v_current_level);

  IF v_next_approver.user_id IS NULL THEN
    RAISE EXCEPTION 'No approver found for the next level. Please ensure a % is assigned to this work.',
      CASE v_current_level + 1
        WHEN 2 THEN 'Sub Division Engineer'
        WHEN 3 THEN 'Divisional Engineer'
        WHEN 4 THEN 'Executive Engineer'
        ELSE 'higher level engineer'
      END;
  END IF;

  -- Upsert workflow: create new OR reset existing sent_back/rejected row
  INSERT INTO estimate.approval_workflows (
    work_id,
    work_type,
    current_level,
    current_approver_id,
    status,
    initiated_by,
    initiated_at,
    completed_at
  ) VALUES (
    p_work_id,
    p_work_type,
    v_next_approver.level,
    v_next_approver.user_id,
    'pending_approval',
    auth.uid(),
    now(),
    NULL
  )
  ON CONFLICT (work_id, work_type) DO UPDATE
    SET current_level        = EXCLUDED.current_level,
        current_approver_id  = EXCLUDED.current_approver_id,
        status               = 'pending_approval',
        initiated_by         = EXCLUDED.initiated_by,
        initiated_at         = EXCLUDED.initiated_at,
        completed_at         = NULL
  RETURNING id INTO v_workflow_id;

  -- Add history entry for this (re-)submission
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
    v_current_level,
    auth.uid(),
    v_initiator_role,
    'submitted',
    v_next_approver.user_id
  );

  -- Update work status
  UPDATE estimate.works
  SET estimate_status = 'in_approval',
      status = 'pending'
  WHERE works_id = p_work_id;

  RETURN v_workflow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update process_approval_action to handle work_type
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
  v_user_role text;
  v_is_admin boolean;
BEGIN
  -- Get workflow details including work_type
  SELECT * INTO v_workflow
  FROM estimate.approval_workflows
  WHERE id = p_workflow_id;

  IF v_workflow IS NULL THEN
    RAISE EXCEPTION 'Workflow not found';
  END IF;

  -- Check if user is the current approver or admin
  SELECT role_id::text INTO v_approver_role
  FROM estimate.work_assignments
  WHERE work_id = v_workflow.work_id AND user_id = auth.uid();

  v_is_admin := EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('admin', 'super_admin', 'developer')
  );

  IF v_workflow.current_approver_id != auth.uid() AND NOT v_is_admin THEN
    RAISE EXCEPTION 'You are not authorized to approve this workflow';
  END IF;

  -- Handle different actions
  IF p_action = 'approved' THEN
    -- Approve and forward to next level
    SELECT * INTO v_next_approver
    FROM estimate.get_next_approver(v_workflow.work_id, v_workflow.current_level);
    
    IF v_next_approver.user_id IS NULL THEN
      RAISE EXCEPTION 'No approver found for next level';
    END IF;

    -- Update workflow to next level
    UPDATE estimate.approval_workflows
    SET current_level = v_next_approver.level,
        current_approver_id = v_next_approver.user_id,
        updated_at = now()
    WHERE id = p_workflow_id;

    -- Record action
    INSERT INTO estimate.approval_history (workflow_id, work_id, level, approver_id, approver_role_id, action, next_approver_id, comments)
    VALUES (p_workflow_id, v_workflow.work_id, v_workflow.current_level, auth.uid(), v_approver_role::integer, 'approved', v_next_approver.user_id, p_comments);

  ELSIF p_action = 'approved_final' THEN
    -- Final approval - only by level 4 or admin
    IF v_workflow.current_level != 4 AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Only Executive Engineers (level 4) or admins can do final approval';
    END IF;

    UPDATE estimate.approval_workflows
    SET status = 'approved',
        completed_at = now(),
        updated_at = now()
    WHERE id = p_workflow_id;

    -- Update work status
    UPDATE estimate.works
    SET estimate_status = 'approved',
        status = 'approved'
    WHERE works_id = v_workflow.work_id;

    INSERT INTO estimate.approval_history (workflow_id, work_id, level, approver_id, approver_role_id, action, comments)
    VALUES (p_workflow_id, v_workflow.work_id, v_workflow.current_level, auth.uid(), v_approver_role::integer, 'approved_final', p_comments);

  ELSIF p_action = 'rejected' THEN
    -- Reject workflow
    IF p_comments IS NULL OR p_comments = '' THEN
      RAISE EXCEPTION 'Comments are required for rejection';
    END IF;

    UPDATE estimate.approval_workflows
    SET status = 'rejected',
        completed_at = now(),
        updated_at = now()
    WHERE id = p_workflow_id;

    UPDATE estimate.works
    SET estimate_status = 'rejected'
    WHERE works_id = v_workflow.work_id;

    INSERT INTO estimate.approval_history (workflow_id, work_id, level, approver_id, approver_role_id, action, comments)
    VALUES (p_workflow_id, v_workflow.work_id, v_workflow.current_level, auth.uid(), v_approver_role::integer, 'rejected', p_comments);

  ELSIF p_action = 'sent_back' THEN
    -- Send back for revision
    IF p_comments IS NULL OR p_comments = '' THEN
      RAISE EXCEPTION 'Comments are required when sending back';
    END IF;

    UPDATE estimate.approval_workflows
    SET status = 'sent_back',
        completed_at = now(),
        updated_at = now()
    WHERE id = p_workflow_id;

    UPDATE estimate.works
    SET estimate_status = 'sent_back'
    WHERE works_id = v_workflow.work_id;

    INSERT INTO estimate.approval_history (workflow_id, work_id, level, approver_id, approver_role_id, action, comments)
    VALUES (p_workflow_id, v_workflow.work_id, v_workflow.current_level, auth.uid(), v_approver_role::integer, 'sent_back', p_comments);

  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
