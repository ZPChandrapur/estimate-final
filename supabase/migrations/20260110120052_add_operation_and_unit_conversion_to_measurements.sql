/*
  # Add operation and unit conversion fields to item_measurements

  1. Changes
    - Add `operation_type` column (none, multiply, divide, add, subtract)
    - Add `operation_value` numeric column for the operation value
    - Add `final_unit` column for converted unit
    - Add `final_quantity` column for the final calculated quantity after operation and conversion

  2. Notes
    - operation_type defaults to 'none'
    - operation_value defaults to 0
    - final_unit will be populated if unit conversion is needed
    - final_quantity will be the result after applying operation and conversion
*/

-- Add operation type column
ALTER TABLE estimate.item_measurements 
ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'none' CHECK (operation_type IN ('none', 'multiply', 'divide', 'add', 'subtract'));

-- Add operation value column
ALTER TABLE estimate.item_measurements 
ADD COLUMN IF NOT EXISTS operation_value NUMERIC DEFAULT 0;

-- Add final unit column
ALTER TABLE estimate.item_measurements 
ADD COLUMN IF NOT EXISTS final_unit TEXT;

-- Add final quantity column (result after operation and conversion)
ALTER TABLE estimate.item_measurements 
ADD COLUMN IF NOT EXISTS final_quantity NUMERIC DEFAULT 0;

-- Update existing records
UPDATE estimate.item_measurements 
SET operation_type = 'none',
    operation_value = 0,
    final_quantity = calculated_quantity,
    final_unit = unit
WHERE operation_type IS NULL;