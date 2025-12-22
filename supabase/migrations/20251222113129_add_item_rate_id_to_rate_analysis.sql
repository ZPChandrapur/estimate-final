/*
  # Add item_rate_id to item_rate_analysis table

  1. Changes
    - Add `item_rate_id` column to link rate analysis to specific rates
    - This allows each rate (when an item has multiple rates) to have its own rate analysis
    
  2. Notes
    - Column is nullable to support existing data and items without specific rate associations
    - Column references `item_rates.sr_no` for data integrity
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'estimate' 
    AND table_name = 'item_rate_analysis' 
    AND column_name = 'item_rate_id'
  ) THEN
    ALTER TABLE estimate.item_rate_analysis 
    ADD COLUMN item_rate_id integer;

    ALTER TABLE estimate.item_rate_analysis
    ADD CONSTRAINT fk_item_rate_id 
    FOREIGN KEY (item_rate_id) 
    REFERENCES estimate.item_rates(sr_no) 
    ON DELETE CASCADE;
  END IF;
END $$;
