/*
  # Sync Work Status with Approval Workflow
  
  ## Changes
  - Update initiate_approval_workflow to set status to 'pending' when approval starts
  - Update process_approval_action to sync status field with approval actions:
    - 'approved' (forwarded): status = 'pending' (still in approval process)
    - 'approved_final': status = 'approved' (work fully approved)
    - 'rejected': status = 'rejected' (work rejected)
    - 'sent_back': status = 'draft' (sent back for modifications)
  
  ## Purpose
  - Ensures the status column in works table reflects the current approval state
  - Provides users with clear visibility of work progress through both status and estimate_status
*/

-- Update initiate_approval_workflow to set status to 'pending'
CREATE OR REPLACE FUNCTION estimate.initiate_approval_workflow(
  p_work_id text
)
RETURNS uuid AS $$
DECLARE
  v_workflow_id uuid;
  v_next_approver record;
  v_initiator_role integer;
  v_current_level integer;
BEGIN
  -- Get initiator's role
  SELECT role_id INTO v_initiator_role
  FROM estimate.work_assignments
  WHERE work_id = p_work_id AND user_id = auth.uid()
  LIMIT 1;
  
  -- Check if user is assigned to this work
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
    v_current_level,
    auth.uid(),
    v_initiator_role,
    'submitted',
    v_next_approver.user_id
  );
  
  -- Update work status and estimate_status
  UPDATE estimate.works
  SET estimate_status = 'in_approval',
      status = 'pending'
  WHERE works_id = p_work_id;
  
  RETURN v_workflow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update process_approval_action to sync status field
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
  -- Get workflow details
  SELECT * INTO v_workflow
  FROM estimate.approval_workflows
  WHERE id = p_workflow_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workflow not found';
  END IF;
  
  -- Check if user has admin/developer role
  SELECT r.name INTO v_user_role
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid()
  LIMIT 1;
  
  v_is_admin := (v_user_role IN ('super_admin', 'developer'));
  
  -- Verify current user is the approver OR has admin privileges
  IF NOT v_is_admin AND v_workflow.current_approver_id != auth.uid() THEN
    RAISE EXCEPTION 'Only current approver can take action';
  END IF;
  
  -- Get approver's role (may be null for admins not assigned to work)
  SELECT role_id INTO v_approver_role
  FROM estimate.work_assignments
  WHERE work_id = v_workflow.work_id AND user_id = auth.uid()
  LIMIT 1;
  
  -- Handle different actions
  IF p_action = 'approved' THEN
    -- Approve and forward to next level
    SELECT * INTO v_next_approver
    FROM estimate.get_next_approver(v_workflow.work_id, v_workflow.current_level);
    
    IF v_next_approver.user_id IS NULL THEN
      RAISE EXCEPTION 'No approver found for next level';
    END IF;
    
    UPDATE estimate.approval_workflows
    SET current_level = v_next_approver.level,
        current_approver_id = v_next_approver.user_id
    WHERE id = p_workflow_id;
    
    -- Keep status as 'pending' since still in approval process
    UPDATE estimate.works
    SET status = 'pending'
    WHERE works_id = v_workflow.work_id;
    
    INSERT INTO estimate.approval_history (
      workflow_id, work_id, level, approver_id, approver_role_id, 
      action, comments, next_approver_id
    ) VALUES (
      p_workflow_id, v_workflow.work_id, v_workflow.current_level, 
      auth.uid(), v_approver_role, 'forwarded', p_comments, v_next_approver.user_id
    );
    
  ELSIF p_action = 'approved_final' THEN
    -- Final approval (admin override or level 4)
    IF NOT v_is_admin AND v_workflow.current_level != 4 THEN
      RAISE EXCEPTION 'Only Executive Engineers (level 4) or admins can do final approval';
    END IF;
    
    UPDATE estimate.approval_workflows
    SET status = 'approved',
        completed_at = now()
    WHERE id = p_workflow_id;
    
    -- Set both status and estimate_status to 'approved'
    UPDATE estimate.works
    SET estimate_status = 'approved',
        status = 'approved'
    WHERE works_id = v_workflow.work_id;
    
    INSERT INTO estimate.approval_history (
      workflow_id, work_id, level, approver_id, approver_role_id, action, comments
    ) VALUES (
      p_workflow_id, v_workflow.work_id, v_workflow.current_level, 
      auth.uid(), v_approver_role, 'approved', p_comments
    );
    
  ELSIF p_action = 'rejected' THEN
    UPDATE estimate.approval_workflows
    SET status = 'rejected',
        completed_at = now()
    WHERE id = p_workflow_id;
    
    -- Set both status and estimate_status to 'rejected'
    UPDATE estimate.works
    SET estimate_status = 'rejected',
        status = 'rejected'
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
    
    -- Set status back to 'draft' for modifications
    UPDATE estimate.works
    SET estimate_status = 'sent_back',
        status = 'draft'
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
