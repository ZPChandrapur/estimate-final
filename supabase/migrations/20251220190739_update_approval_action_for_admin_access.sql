/*
  # Update Approval Action Function for Admin Access
  
  ## Changes
  - Allow super_admin and developer roles to take approval actions on any workflow
  - Regular users can only take action if they are the current approver
  - Maintains existing approval workflow logic
  
  ## Security
  - Checks user role to determine permissions
  - Super admins and developers can bypass current_approver check
*/

-- Update the process_approval_action function to allow admin override
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