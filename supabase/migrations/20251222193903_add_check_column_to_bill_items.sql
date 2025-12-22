/*
  # Add Check Column to Bill Items
  
  1. Changes
    - Add `is_checked` column to `mb_bill_items` table
    - Add `checked_by` column to track who checked the item
    - Add `checked_at` column to track when it was checked
    - Add `check_percentage` column to store the percentage for this check
  
  2. Purpose
    - Allow individual bill items to be marked as checked during verification
    - Track who performed the check and when
    - Calculate check percentage for each item
*/

-- Add check columns to mb_bill_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'estimate' 
    AND table_name = 'mb_bill_items' 
    AND column_name = 'is_checked'
  ) THEN
    ALTER TABLE estimate.mb_bill_items ADD COLUMN is_checked boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'estimate' 
    AND table_name = 'mb_bill_items' 
    AND column_name = 'checked_by'
  ) THEN
    ALTER TABLE estimate.mb_bill_items ADD COLUMN checked_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'estimate' 
    AND table_name = 'mb_bill_items' 
    AND column_name = 'checked_at'
  ) THEN
    ALTER TABLE estimate.mb_bill_items ADD COLUMN checked_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'estimate' 
    AND table_name = 'mb_bill_items' 
    AND column_name = 'check_percentage'
  ) THEN
    ALTER TABLE estimate.mb_bill_items ADD COLUMN check_percentage numeric DEFAULT 0;
  END IF;
END $$;
