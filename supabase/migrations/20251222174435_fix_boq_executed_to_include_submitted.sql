/*
  # Fix BOQ executed quantities to include submitted measurements
  
  1. Changes
    - Drop the auto-calculate amount trigger (amount is already a GENERATED column)
    - Update BOQ executed calculation to include 'submitted' measurements
    - This allows users to see submitted measurements reflected in the executed column
    
  2. Logic
    - Executed now includes: submitted, je_approved, de_approved, ee_approved
    - Balance automatically recalculates based on executed_quantity
*/

-- Drop the auto-calculate amount trigger (not needed since amount is a GENERATED column)
DROP TRIGGER IF EXISTS trigger_calculate_measurement_amount ON estimate.mb_measurements;
DROP FUNCTION IF EXISTS estimate.calculate_measurement_amount();

-- Update the function to include submitted measurements
CREATE OR REPLACE FUNCTION estimate.update_boq_executed_quantities()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the BOQ item with aggregated measurements (including submitted)
  UPDATE estimate.mb_boq_items
  SET 
    executed_quantity = COALESCE((
      SELECT SUM(quantity)
      FROM estimate.mb_measurements
      WHERE boq_item_id = COALESCE(NEW.boq_item_id, OLD.boq_item_id)
        AND status IN ('submitted', 'je_approved', 'de_approved', 'ee_approved')
    ), 0),
    executed_amount = COALESCE((
      SELECT SUM(amount)
      FROM estimate.mb_measurements
      WHERE boq_item_id = COALESCE(NEW.boq_item_id, OLD.boq_item_id)
        AND status IN ('submitted', 'je_approved', 'de_approved', 'ee_approved')
    ), 0),
    updated_at = now()
  WHERE id = COALESCE(NEW.boq_item_id, OLD.boq_item_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;