/*
  # Fix Approval Workflow Visibility for Engineers

  ## Problem
  Engineers (JE, Sub Div, Div, Executive) could only see workflows if they were:
  1. Assigned to the work
  2. The current approver
  
  This prevented executives from seeing workflows at their level if they weren't explicitly assigned.

  ## Solution
  Update RLS policy to allow engineers to view workflows at their approval level based on their role,
  even if not explicitly assigned to the work.
  
  - Level 1: Junior Engineer (role_id 10)
  - Level 2: Sub Division Engineer (role_id 15)
  - Level 3: Divisional Engineer (role_id 16)
  - Level 4: Executive Engineer (role_id 17)
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view workflows for assigned works" ON estimate.approval_workflows;

-- Create improved policy that allows role-based access
CREATE POLICY "Users can view workflows for assigned works or their level"
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
    OR
    -- User has a role matching the current approval level
    -- (allows visibility even if not explicitly assigned)
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (
        -- Level 1: Junior Engineer
        (approval_workflows.current_level = 1 AND ur.role_id = 10)
        OR
        -- Level 2: Sub Division Engineer
        (approval_workflows.current_level = 2 AND ur.role_id = 15)
        OR
        -- Level 3: Divisional Engineer
        (approval_workflows.current_level = 3 AND ur.role_id = 16)
        OR
        -- Level 4: Executive Engineer
        (approval_workflows.current_level = 4 AND ur.role_id = 17)
      )
    )
  );
