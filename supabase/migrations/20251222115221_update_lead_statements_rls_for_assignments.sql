/*
  # Update Lead Statements RLS to support Work Assignments

  1. Problem
    - Current RLS policies only allow work creators to manage lead statements
    - Users assigned to a work via work_assignments cannot add/edit lead statements
    
  2. Changes
    - Drop existing RLS policies
    - Create new policies that check BOTH work ownership AND work assignments
    - Users can now manage lead statements if they either:
      * Created the work, OR
      * Are assigned to the work via work_assignments table
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert lead statements for their works" ON estimate.lead_statements;
DROP POLICY IF EXISTS "Users can view lead statements for their works" ON estimate.lead_statements;
DROP POLICY IF EXISTS "Users can update lead statements for their works" ON estimate.lead_statements;
DROP POLICY IF EXISTS "Users can delete lead statements for their works" ON estimate.lead_statements;

-- Create new policies that include work assignments
CREATE POLICY "Users can view lead statements for their assigned works"
  ON estimate.lead_statements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.works
      WHERE works.works_id = lead_statements.works_id
      AND (
        works.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM estimate.work_assignments
          WHERE work_assignments.work_id = works.works_id
          AND work_assignments.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can insert lead statements for their assigned works"
  ON estimate.lead_statements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimate.works
      WHERE works.works_id = lead_statements.works_id
      AND (
        works.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM estimate.work_assignments
          WHERE work_assignments.work_id = works.works_id
          AND work_assignments.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update lead statements for their assigned works"
  ON estimate.lead_statements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.works
      WHERE works.works_id = lead_statements.works_id
      AND (
        works.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM estimate.work_assignments
          WHERE work_assignments.work_id = works.works_id
          AND work_assignments.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimate.works
      WHERE works.works_id = lead_statements.works_id
      AND (
        works.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM estimate.work_assignments
          WHERE work_assignments.work_id = works.works_id
          AND work_assignments.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can delete lead statements for their assigned works"
  ON estimate.lead_statements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.works
      WHERE works.works_id = lead_statements.works_id
      AND (
        works.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM estimate.work_assignments
          WHERE work_assignments.work_id = works.works_id
          AND work_assignments.user_id = auth.uid()
        )
      )
    )
  );
