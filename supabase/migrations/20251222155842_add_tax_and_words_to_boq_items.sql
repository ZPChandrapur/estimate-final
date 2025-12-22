/*
  # Add Tax and Amount in Words to BOQ Items

  1. Changes
    - Add `amount_with_taxes` column to `mb_boq_items` table  
    - Add `amount_in_words` column to `mb_boq_items` table
    
  2. Purpose
    - Support BOQ format with taxes and amount in words
    - Match government BOQ template requirements
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'estimate' 
    AND table_name = 'mb_boq_items' 
    AND column_name = 'amount_with_taxes'
  ) THEN
    ALTER TABLE estimate.mb_boq_items 
    ADD COLUMN amount_with_taxes numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'estimate' 
    AND table_name = 'mb_boq_items' 
    AND column_name = 'amount_in_words'
  ) THEN
    ALTER TABLE estimate.mb_boq_items 
    ADD COLUMN amount_in_words text;
  END IF;
END $$;