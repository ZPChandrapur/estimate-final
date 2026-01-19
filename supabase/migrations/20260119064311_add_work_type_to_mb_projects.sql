/*
  # Add Work Type to MB Projects
  
  ## Changes
  - Add work_type field to mb_projects table (TS or TA)
  - Add technical_sanction_no field for TS type works
  - Add technical_approval_no field for TA type works
  - Set default work_type to 'TA' (Technical Approval)
  
  ## Security
  - No RLS changes needed as policies already exist
*/

-- Add work_type column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'work_type') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN work_type text DEFAULT 'TA' CHECK (work_type IN ('TS', 'TA'));
  END IF;
END $$;

-- Add technical_sanction_no column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'technical_sanction_no') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN technical_sanction_no text;
  END IF;
END $$;

-- Add technical_approval_no column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'estimate' AND table_name = 'mb_projects' AND column_name = 'technical_approval_no') THEN
    ALTER TABLE estimate.mb_projects ADD COLUMN technical_approval_no text;
  END IF;
END $$;

-- Update existing projects to have work_type = 'TA' if null
UPDATE estimate.mb_projects SET work_type = 'TA' WHERE work_type IS NULL;