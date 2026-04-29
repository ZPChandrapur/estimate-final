/*
  # Add Digital Signature Support to Approval Workflow
  
  ## Overview
  This migration adds support for:
  - PDF attachment storage in approval workflows
  - Digital signature tracking for each approval level
  - Signature metadata (who signed, when, signature image)
  - Multiple PDF versions (unsigned original → signed at each level → final approved)
  
  ## Tables Added
  1. approval_pdf_attachments - Stores PDF files and metadata
  2. approval_signatures - Tracks individual signatures at each approval level
  
  ## Changes to approval_history table
  - Add signature_id foreign key
  - Track signature time and method
*/

-- Create approval_pdf_attachments table
CREATE TABLE IF NOT EXISTS estimate.approval_pdf_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_workflow_id uuid NOT NULL REFERENCES estimate.approval_workflows(id) ON DELETE CASCADE,
  work_id text NOT NULL REFERENCES estimate.works(works_id) ON DELETE CASCADE,
  pdf_file_path text NOT NULL, -- Path in Supabase storage (e.g., 'approvals/work-id/unsigned.pdf')
  pdf_version text NOT NULL DEFAULT 'unsigned', -- 'unsigned', 'signed_level_1', 'signed_level_2', etc.
  file_size_kb integer,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(approval_workflow_id, pdf_version)
);

-- Create approval_signatures table to track individual signatures
CREATE TABLE IF NOT EXISTS estimate.approval_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_history_id uuid NOT NULL REFERENCES estimate.approval_history(id) ON DELETE CASCADE,
  approval_workflow_id uuid NOT NULL REFERENCES estimate.approval_workflows(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES auth.users(id),
  approver_name text NOT NULL,
  approval_level integer NOT NULL, -- 1, 2, 3, 4
  signature_image_base64 text, -- Base64 encoded signature image (PNG)
  signature_method text NOT NULL DEFAULT 'handwritten', -- 'handwritten', 'typed', 'none'
  signature_timestamp timestamptz DEFAULT now(),
  signed_pdf_path text, -- Path to PDF signed at this level
  ip_address text,
  browser_info text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(approval_workflow_id, approval_level)
);

-- Add signature_id column to approval_history if it doesn't exist
ALTER TABLE estimate.approval_history
ADD COLUMN IF NOT EXISTS signature_id uuid REFERENCES estimate.approval_signatures(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE estimate.approval_pdf_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate.approval_signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approval_pdf_attachments
CREATE POLICY "Users can view PDFs for their assigned works"
  ON estimate.approval_pdf_attachments
  FOR SELECT
  TO authenticated
  USING (
    -- User is assigned to the work
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = approval_pdf_attachments.work_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    -- User is in the approval chain for this workflow
    EXISTS (
      SELECT 1 FROM estimate.approval_history ah
      WHERE ah.workflow_id = approval_pdf_attachments.approval_workflow_id
      AND ah.approver_id = auth.uid()
    )
    OR
    -- User is admin/developer
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
  );

CREATE POLICY "Users can upload PDFs for works being submitted"
  ON estimate.approval_pdf_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = approval_pdf_attachments.work_id
      AND work_assignments.user_id = auth.uid()
    )
  );

-- RLS Policies for approval_signatures
CREATE POLICY "Users can view signatures for their approval workflows"
  ON estimate.approval_signatures
  FOR SELECT
  TO authenticated
  USING (
    -- User is in the approval chain
    EXISTS (
      SELECT 1 FROM estimate.approval_history ah
      WHERE ah.workflow_id = approval_signatures.approval_workflow_id
      AND ah.approver_id = auth.uid()
    )
    OR
    -- User is assigned to the work
    EXISTS (
      SELECT 1 FROM estimate.work_assignments wa
      JOIN estimate.approval_workflows aw ON wa.work_id = aw.work_id
      WHERE aw.id = approval_signatures.approval_workflow_id
      AND wa.user_id = auth.uid()
    )
    OR
    -- User is admin/developer
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
  );

CREATE POLICY "Users can create signatures for their approval actions"
  ON estimate.approval_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (approver_id = auth.uid());

CREATE POLICY "Users can update their signatures"
  ON estimate.approval_signatures
  FOR UPDATE
  TO authenticated
  USING (approver_id = auth.uid())
  WITH CHECK (approver_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_approval_pdf_attachments_workflow_id 
  ON estimate.approval_pdf_attachments(approval_workflow_id);
CREATE INDEX IF NOT EXISTS idx_approval_pdf_attachments_work_id 
  ON estimate.approval_pdf_attachments(work_id);
CREATE INDEX IF NOT EXISTS idx_approval_signatures_workflow_id 
  ON estimate.approval_signatures(approval_workflow_id);
CREATE INDEX IF NOT EXISTS idx_approval_signatures_approver_id 
  ON estimate.approval_signatures(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_signatures_approval_level 
  ON estimate.approval_signatures(approval_level);
