/*
  # Add year field to works table
  
  1. Changes
    - Add `year` column to `estimate.works` table to store financial year (e.g., "2024-25")
  
  2. Details
    - Column type: text to store year in "YYYY-YY" format
    - Nullable: YES (existing records won't have this field)
    - Default: NULL
*/

-- Add year column to works table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'estimate' AND table_name = 'works' AND column_name = 'year'
  ) THEN
    ALTER TABLE estimate.works ADD COLUMN year text;
  END IF;
END $$;
