/*
  # Add Work Assignments and Engineer Roles
  
  1. New Tables
    - `estimate.work_assignments`
      - `id` (uuid, primary key) - Unique identifier for the assignment
      - `work_id` (text) - Reference to estimate.works.works_id
      - `user_id` (uuid) - Reference to auth.users.id
      - `role_id` (integer) - Reference to public.roles.id
      - `assigned_by` (uuid) - User who made the assignment
      - `created_at` (timestamptz) - When assignment was created
      - `updated_at` (timestamptz) - When assignment was last updated
  
  2. New Roles
    - Junior Engineer (JE)
    - Sub Division Engineer
    - Divisional Engineer
    - Executive Engineer
  
  3. Security
    - Enable RLS on work_assignments table
    - Add policies for authenticated users to read their assigned works
    - Add policies for admins to manage assignments
    - Update works table RLS to check assignments
*/

-- Add engineer roles to public.roles table with explicit IDs
INSERT INTO public.roles (id, name, description, application)
VALUES 
  (15, 'Sub Division Engineer', 'Sub Division Engineer for estimate management', 'estimate'),
  (16, 'Divisional Engineer', 'Divisional Engineer for estimate approval', 'estimate'),
  (17, 'Executive Engineer', 'Executive Engineer for estimate oversight', 'estimate')
ON CONFLICT (id) DO NOTHING;

-- Create work_assignments table in estimate schema
CREATE TABLE IF NOT EXISTS estimate.work_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id text NOT NULL REFERENCES estimate.works(works_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id integer REFERENCES public.roles(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(work_id, user_id)
);

-- Enable RLS on work_assignments
ALTER TABLE estimate.work_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own assignments
CREATE POLICY "Users can view own work assignments"
  ON estimate.work_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Admins can view all assignments
CREATE POLICY "Admins can view all work assignments"
  ON estimate.work_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
  );

-- Policy: Admins can insert assignments
CREATE POLICY "Admins can create work assignments"
  ON estimate.work_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
  );

-- Policy: Admins can update assignments
CREATE POLICY "Admins can update work assignments"
  ON estimate.work_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
  );

-- Policy: Admins can delete assignments
CREATE POLICY "Admins can delete work assignments"
  ON estimate.work_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles 
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
  );

-- Drop existing works SELECT policies if they exist
DROP POLICY IF EXISTS "Users can view works" ON estimate.works;
DROP POLICY IF EXISTS "Users can view assigned works" ON estimate.works;

-- Update works table RLS policy to check assignments
CREATE POLICY "Users can view assigned works"
  ON estimate.works
  FOR SELECT
  TO authenticated
  USING (
    -- User is admin/super_admin/developer (can see all works)
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
      WHERE work_assignments.work_id = works.works_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    -- User created the work
    created_by = auth.uid()
  );

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_work_assignments_user_id ON estimate.work_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_work_assignments_work_id ON estimate.work_assignments(work_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION estimate.update_work_assignment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_work_assignment_updated_at ON estimate.work_assignments;
CREATE TRIGGER update_work_assignment_updated_at
  BEFORE UPDATE ON estimate.work_assignments
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_work_assignment_updated_at();
