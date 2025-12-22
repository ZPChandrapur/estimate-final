/*
  # Update BOQ items from measurements
  
  1. Function and Trigger
    - Create function to calculate and update executed quantities and amounts
    - Updates mb_boq_items.executed_quantity from approved measurements
    - Updates mb_boq_items.executed_amount from approved measurements
    - Recalculates balance_quantity automatically
    
  2. Logic
    - Sums all approved measurement quantities for each BOQ item
    - Updates executed_quantity and executed_amount
    - Triggered on INSERT, UPDATE, DELETE of measurements
    - Only counts measurements with status 'je_approved', 'de_approved', or 'ee_approved'
*/

-- Function to update BOQ item executed quantities and amounts
CREATE OR REPLACE FUNCTION estimate.update_boq_executed_quantities()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the BOQ item with aggregated measurements
  UPDATE estimate.mb_boq_items
  SET 
    executed_quantity = COALESCE((
      SELECT SUM(quantity)
      FROM estimate.mb_measurements
      WHERE boq_item_id = COALESCE(NEW.boq_item_id, OLD.boq_item_id)
        AND status IN ('je_approved', 'de_approved', 'ee_approved')
    ), 0),
    executed_amount = COALESCE((
      SELECT SUM(amount)
      FROM estimate.mb_measurements
      WHERE boq_item_id = COALESCE(NEW.boq_item_id, OLD.boq_item_id)
        AND status IN ('je_approved', 'de_approved', 'ee_approved')
    ), 0),
    updated_at = now()
  WHERE id = COALESCE(NEW.boq_item_id, OLD.boq_item_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_boq_executed ON estimate.mb_measurements;

-- Create trigger on measurements table
CREATE TRIGGER trigger_update_boq_executed
AFTER INSERT OR UPDATE OR DELETE ON estimate.mb_measurements
FOR EACH ROW
EXECUTE FUNCTION estimate.update_boq_executed_quantities();

-- Update balance_quantity function to be automatic
CREATE OR REPLACE FUNCTION estimate.update_boq_balance_quantity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance_quantity := NEW.boq_quantity - COALESCE(NEW.executed_quantity, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_balance_quantity ON estimate.mb_boq_items;

-- Create trigger to auto-calculate balance
CREATE TRIGGER trigger_update_balance_quantity
BEFORE INSERT OR UPDATE ON estimate.mb_boq_items
FOR EACH ROW
EXECUTE FUNCTION estimate.update_boq_balance_quantity();