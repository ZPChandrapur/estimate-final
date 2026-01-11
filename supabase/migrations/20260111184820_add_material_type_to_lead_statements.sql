/*
  # Add Material Type to Lead Statements

  1. Changes
    - Add `material_type` column to `lead_statements` table
      - This stores the specific material type from lead charges search
      - e.g., "Excavated Rock soling stone", "Sand, Stone below 40 mm", etc.

  2. Notes
    - The `material` column will now store the category (80 mm H.B Metal, Sand, etc.)
    - The `material_type` column stores the specific type from lead charges lookup
*/

-- Add material_type column to lead_statements table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'estimate'
    AND table_name = 'lead_statements'
    AND column_name = 'material_type'
  ) THEN
    ALTER TABLE estimate.lead_statements
    ADD COLUMN material_type text;
  END IF;
END $$;
