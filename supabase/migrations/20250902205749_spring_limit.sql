/*
  # Add Document Reference Column to Item Rates

  1. Changes
    - Add `document_reference` column to `item_rates` table
    - Column is optional (nullable) text field for storing document references

  2. Security
    - No changes to existing RLS policies needed
*/

-- Add document_reference column to item_rates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'estimate' 
    AND table_name = 'item_rates' 
    AND column_name = 'document_reference'
  ) THEN
    ALTER TABLE estimate.item_rates ADD COLUMN document_reference text;
  END IF;
END $$;