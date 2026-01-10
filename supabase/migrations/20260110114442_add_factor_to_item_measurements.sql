/*
  # Add factor column to item_measurements

  1. Changes
    - Add `factor` column to `item_measurements` table
    - Set default value to 1
    - Update existing records to have factor = 1

  2. Notes
    - Factor will be used in calculation: factor × no_of_units × length × width_breadth × height_depth
*/

-- Add factor column with default value 1
ALTER TABLE estimate.item_measurements 
ADD COLUMN IF NOT EXISTS factor NUMERIC DEFAULT 1 NOT NULL;

-- Update existing records to have factor = 1
UPDATE estimate.item_measurements 
SET factor = 1 
WHERE factor IS NULL;