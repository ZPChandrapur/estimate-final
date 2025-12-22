/*
  # Auto-calculate measurement amount
  
  1. Function and Trigger
    - Automatically calculate amount = quantity * rate
    - Ensures amount is always correct before insert/update
    - Prevents manual errors in amount calculation
*/

-- Function to auto-calculate measurement amount
CREATE OR REPLACE FUNCTION estimate.calculate_measurement_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate amount from quantity and rate
  NEW.amount := COALESCE(NEW.quantity, 0) * COALESCE(NEW.rate, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_calculate_measurement_amount ON estimate.mb_measurements;

-- Create trigger to auto-calculate amount
CREATE TRIGGER trigger_calculate_measurement_amount
BEFORE INSERT OR UPDATE ON estimate.mb_measurements
FOR EACH ROW
EXECUTE FUNCTION estimate.calculate_measurement_amount();