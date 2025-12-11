/*
  # Add selected_rate_id column to item_measurements table

  1. Schema Changes
    - Add `selected_rate_id` column to `item_measurements` table
    - Set as nullable integer to reference item rates
    - Add foreign key constraint to `item_rates` table

  2. Purpose
    - Allows measurements to reference specific rates when multiple rates exist
    - Supports the "2 rates" functionality mentioned by the user
*/

-- Add the selected_rate_id column to item_measurements table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'item_measurements' AND column_name = 'selected_rate_id'
  ) THEN
    ALTER TABLE item_measurements ADD COLUMN selected_rate_id integer;
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'item_measurements_selected_rate_id_fkey'
  ) THEN
    ALTER TABLE item_measurements 
    ADD CONSTRAINT item_measurements_selected_rate_id_fkey 
    FOREIGN KEY (selected_rate_id) REFERENCES item_rates(sr_no);
  END IF;
END $$;