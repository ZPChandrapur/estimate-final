/*
  # Update initiate_approval_workflow function with better error handling

  ## Changes
  - Add better error messages when user is not assigned to work
  - Add better error messages when no approver is found
  - Handle edge cases more gracefully
*/

-- Drop and recreate the function with better error handling
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
  
  -- Update work status
  UPDATE estimate.works
  SET estimate_status = 'in_approval'
  WHERE works_id = p_work_id;
  
  RETURN v_workflow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
