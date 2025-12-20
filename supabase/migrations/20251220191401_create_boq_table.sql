/*
  # Create BOQ (Bill of Quantities) Table
  
  ## Overview
  Creates table to store BOQ (Schedule B) data for approved works.
  BOQ contains final work and subwork details with estimated quantities, rates, and totals.
  
  ## New Tables
  - `boq` (in estimate schema)
    - `id` (uuid, primary key) - Unique identifier for BOQ
    - `work_id` (text, foreign key) - Reference to works table
    - `boq_data` (jsonb) - Structured BOQ data with items, quantities, rates
    - `generated_at` (timestamptz) - When BOQ was generated
    - `generated_by` (uuid, foreign key) - User who generated the BOQ
    - `updated_at` (timestamptz) - Last update timestamp
    - `updated_by` (uuid) - User who last updated
  
  ## BOQ Data Structure (jsonb format):
  {
    "project_title": "Storage Tank Hanuman nagar (Kohor)",
    "sections": [
      {
        "name": "PART I",
        "subsections": [
          {
            "name": "ABSTRACT - DAM PROPER",
            "items": [
              {
                "item_no": 1,
                "quantity": 3602.00,
                "description": "Item No. 1:- Description...",
                "rate_figure": 2.55,
                "rate_words": "Rupees Two and Paise Fifty Five Only",
                "unit": "Sqm.",
                "total_amount": 9185.1
              }
            ]
          }
        ]
      }
    ]
  }
  
  ## Security
  - Enable RLS on boq table
  - Users can view BOQ for works they're assigned to
  - Only assigned users and admins can create/update BOQ
  - Super admins and developers have full access
*/

-- Create BOQ table
CREATE TABLE IF NOT EXISTS estimate.boq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id text NOT NULL REFERENCES estimate.works(works_id) ON DELETE CASCADE,
  boq_data jsonb NOT NULL DEFAULT '{"sections": []}'::jsonb,
  generated_at timestamptz DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(work_id)
);

-- Enable RLS
ALTER TABLE estimate.boq ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view BOQ for works they're assigned to
CREATE POLICY "Users can view BOQ for assigned works"
  ON estimate.boq
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = boq.work_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'developer')
    )
  );

-- Policy: Users can create BOQ for works they're assigned to
CREATE POLICY "Users can create BOQ for assigned works"
  ON estimate.boq
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = boq.work_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'developer')
    )
  );

-- Policy: Users can update BOQ for works they're assigned to
CREATE POLICY "Users can update BOQ for assigned works"
  ON estimate.boq
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = boq.work_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = boq.work_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'developer')
    )
  );

-- Policy: Super admins and developers can delete BOQ
CREATE POLICY "Admins can delete BOQ"
  ON estimate.boq
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'developer')
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_boq_work_id ON estimate.boq(work_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION estimate.update_boq_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_boq_timestamp
  BEFORE UPDATE ON estimate.boq
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_boq_updated_at();