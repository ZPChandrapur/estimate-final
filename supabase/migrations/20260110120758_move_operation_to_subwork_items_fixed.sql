/*
  # Move operation and unit conversion to subwork_items level

  1. Changes
    - Remove operation fields from item_measurements table
    - Add operation fields to subwork_items table for total quantity calculations
    - Add operation_type, operation_value, final_unit, final_quantity to subwork_items

  2. Notes
    - Operations apply to the total calculated quantity of all measurements
    - This allows converting the final total (e.g., CUM to MT, adding wastage)
*/

-- Remove operation columns from item_measurements
ALTER TABLE estimate.item_measurements 
DROP COLUMN IF EXISTS operation_type,
DROP COLUMN IF EXISTS operation_value,
DROP COLUMN IF EXISTS final_unit,
DROP COLUMN IF EXISTS final_quantity;

-- Add operation columns to subwork_items
ALTER TABLE estimate.subwork_items 
ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'none' CHECK (operation_type IN ('none', 'multiply', 'divide', 'add', 'subtract'));

ALTER TABLE estimate.subwork_items 
ADD COLUMN IF NOT EXISTS operation_value NUMERIC DEFAULT 0;

ALTER TABLE estimate.subwork_items 
ADD COLUMN IF NOT EXISTS final_unit TEXT;

ALTER TABLE estimate.subwork_items 
ADD COLUMN IF NOT EXISTS final_quantity NUMERIC DEFAULT 0;

-- Update existing records
UPDATE estimate.subwork_items 
SET operation_type = 'none',
    operation_value = 0,
    final_quantity = ssr_quantity,
    final_unit = ssr_unit
WHERE operation_type IS NULL;