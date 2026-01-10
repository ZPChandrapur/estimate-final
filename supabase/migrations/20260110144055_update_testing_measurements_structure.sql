/*
  # Update Testing Measurements Table Structure

  1. Changes
    - Remove royalty-related columns (metal_factor, hb_metal, murum_factor, murum, sand_factor, sand)
    - Add testing-specific columns:
      - `description` (text) - Description of the test
      - `quantity` (numeric) - Quantity to be tested
      - `required_tests` (numeric) - Number of required tests
      - `total` (numeric) - Total calculated value (quantity * required_tests or similar)

  2. Security
    - RLS policies remain unchanged
    - Existing triggers updated to calculate total

  3. Important Notes
    - This changes the testing_measurements table structure to be specific for testing
    - Auto-calculates total based on quantity and required_tests
*/

-- Drop old trigger and function for testing_measurements
DROP TRIGGER IF EXISTS trigger_calculate_testing_measurements ON estimate.testing_measurements;
DROP FUNCTION IF EXISTS estimate.calculate_testing_measurements();

-- Remove old columns from testing_measurements
ALTER TABLE estimate.testing_measurements 
  DROP COLUMN IF EXISTS metal_factor,
  DROP COLUMN IF EXISTS hb_metal,
  DROP COLUMN IF EXISTS murum_factor,
  DROP COLUMN IF EXISTS murum,
  DROP COLUMN IF EXISTS sand_factor,
  DROP COLUMN IF EXISTS sand;

-- Rename measurement to quantity
ALTER TABLE estimate.testing_measurements 
  RENAME COLUMN measurement TO quantity;

-- Add new columns for testing
ALTER TABLE estimate.testing_measurements 
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS required_tests NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total NUMERIC NOT NULL DEFAULT 0;

-- Create trigger function to auto-calculate total
CREATE OR REPLACE FUNCTION estimate.calculate_testing_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total := NEW.quantity * NEW.required_tests;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-calculate testing total
CREATE TRIGGER trigger_calculate_testing_total
  BEFORE INSERT OR UPDATE ON estimate.testing_measurements
  FOR EACH ROW
  EXECUTE FUNCTION estimate.calculate_testing_total();
