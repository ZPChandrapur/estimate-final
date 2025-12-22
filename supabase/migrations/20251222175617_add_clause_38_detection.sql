/*
  # Add Clause 38 Detection for Excess Quantities
  
  1. Changes
    - Add is_clause_38_applicable boolean column to mb_boq_items
    - Add excess_percentage calculated column
    - Update trigger to check if executed quantity exceeds BOQ by 25%+
    - Mark item for Clause 38 when threshold is crossed
    
  2. Logic
    - When executed_quantity > boq_quantity * 1.25, mark as Clause 38 applicable
    - Excess percentage = ((executed - boq) / boq) * 100
*/

-- Add columns to track Clause 38 applicability
ALTER TABLE estimate.mb_boq_items 
ADD COLUMN IF NOT EXISTS is_clause_38_applicable boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS excess_percentage numeric(5, 2) DEFAULT 0;

-- Create index for quick lookup of Clause 38 items
CREATE INDEX IF NOT EXISTS idx_mb_boq_items_clause_38 
ON estimate.mb_boq_items(is_clause_38_applicable) 
WHERE is_clause_38_applicable = true;

-- Update the trigger function to check for Clause 38
CREATE OR REPLACE FUNCTION estimate.update_boq_executed_quantities()
RETURNS TRIGGER AS $$
DECLARE
  v_boq_quantity numeric(15, 3);
  v_executed_quantity numeric(15, 3);
  v_excess_percentage numeric(5, 2);
  v_is_clause_38 boolean;
BEGIN
  -- Get the BOQ quantity
  SELECT boq_quantity INTO v_boq_quantity
  FROM estimate.mb_boq_items
  WHERE id = COALESCE(NEW.boq_item_id, OLD.boq_item_id);
  
  -- Calculate executed quantity
  SELECT COALESCE(SUM(quantity), 0) INTO v_executed_quantity
  FROM estimate.mb_measurements
  WHERE boq_item_id = COALESCE(NEW.boq_item_id, OLD.boq_item_id)
    AND status IN ('submitted', 'je_approved', 'de_approved', 'ee_approved');
  
  -- Calculate excess percentage
  IF v_boq_quantity > 0 THEN
    v_excess_percentage := ((v_executed_quantity - v_boq_quantity) / v_boq_quantity) * 100;
  ELSE
    v_excess_percentage := 0;
  END IF;
  
  -- Check if Clause 38 applies (25% or more excess)
  v_is_clause_38 := v_excess_percentage >= 25;
  
  -- Update the BOQ item
  UPDATE estimate.mb_boq_items
  SET 
    executed_quantity = v_executed_quantity,
    executed_amount = COALESCE((
      SELECT SUM(amount)
      FROM estimate.mb_measurements
      WHERE boq_item_id = COALESCE(NEW.boq_item_id, OLD.boq_item_id)
        AND status IN ('submitted', 'je_approved', 'de_approved', 'ee_approved')
    ), 0),
    excess_percentage = v_excess_percentage,
    is_clause_38_applicable = v_is_clause_38,
    updated_at = now()
  WHERE id = COALESCE(NEW.boq_item_id, OLD.boq_item_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recalculate for existing items
DO $$
DECLARE
  v_item record;
  v_executed_quantity numeric(15, 3);
  v_excess_percentage numeric(5, 2);
BEGIN
  FOR v_item IN SELECT id, boq_quantity FROM estimate.mb_boq_items
  LOOP
    -- Get executed quantity
    SELECT COALESCE(SUM(quantity), 0) INTO v_executed_quantity
    FROM estimate.mb_measurements
    WHERE boq_item_id = v_item.id
      AND status IN ('submitted', 'je_approved', 'de_approved', 'ee_approved');
    
    -- Calculate excess percentage
    IF v_item.boq_quantity > 0 THEN
      v_excess_percentage := ((v_executed_quantity - v_item.boq_quantity) / v_item.boq_quantity) * 100;
    ELSE
      v_excess_percentage := 0;
    END IF;
    
    -- Update item
    UPDATE estimate.mb_boq_items
    SET 
      excess_percentage = v_excess_percentage,
      is_clause_38_applicable = (v_excess_percentage >= 25)
    WHERE id = v_item.id;
  END LOOP;
END $$;