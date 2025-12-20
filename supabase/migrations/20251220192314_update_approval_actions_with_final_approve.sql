/*
  # Update Approval Actions with Final Approve
  
  ## Changes
  - Add support for "approved_final" action for direct final approval
  - "approved" action now forwards to next level
  - Super admins and developers can use "approved_final" to bypass hierarchy
  - Executive Engineers (level 4) can use "approved_final" for final approval
  
  ## Actions
  - approved: Approve and forward to next level
  - approved_final: Final approval (completes workflow)
  - rejected: Reject the estimate
  - sent_back: Send back for modifications
*/

-- Drop existing function
DROP FUNCTION IF EXISTS estimate.process_approval_action(uuid, text, text);

-- Create updated function with new actions
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
    
    UPDATE estimate.works
    SET estimate_status = 'approved'
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

-- Update public wrapper function
DROP FUNCTION IF EXISTS public.process_approval_action(uuid, text, text);

CREATE OR REPLACE FUNCTION public.process_approval_action(
  p_workflow_id uuid,
  p_action text,
  p_comments text DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  RETURN estimate.process_approval_action(p_workflow_id, p_action, p_comments);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.process_approval_action(uuid, text, text) TO authenticated;