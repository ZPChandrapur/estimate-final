/*
  # Fix initiate_approval_workflow for re-submission after sent_back / rejected

  ## Problem
  The approval_workflows table has a unique constraint on work_id.
  When a work is sent back or rejected and the user tries to re-submit,
  the function tried to INSERT a new row, violating that constraint.

  ## Fix
  Use INSERT ... ON CONFLICT (work_id) DO UPDATE so that:
  - First submission: creates a new workflow row
  - Re-submission (after sent_back / rejected): resets the existing row
    (status, current_level, current_approver_id, initiated_by, initiated_at)
  - Also reset completed_at to NULL so the workflow is live again
*/

CREATE OR REPLACE FUNCTION estimate.initiate_approval_workflow(
  p_work_id text
)
RETURNS uuid AS $$
DECLARE
  v_workflow_id uuid;
  v_next_approver record;
  v_initiator_role integer;
  v_current_level integer;
  v_existing_status text;
BEGIN
  -- Block re-submission if workflow is still active
  SELECT status INTO v_existing_status
  FROM estimate.approval_workflows
  WHERE work_id = p_work_id;

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
    current_level,
    current_approver_id,
    status,
    initiated_by,
    initiated_at,
    completed_at
  ) VALUES (
    p_work_id,
    v_next_approver.level,
    v_next_approver.user_id,
    'pending_approval',
    auth.uid(),
    now(),
    NULL
  )
  ON CONFLICT (work_id) DO UPDATE
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
