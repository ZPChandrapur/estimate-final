/*
  # Fix item_rate_analysis foreign key constraint and clean invalid data

  1. Problem
    - The `subwork_item_id` column in `item_rate_analysis` was incorrectly 
      referencing `subworks.sr_no` instead of `subwork_items.sr_no`
    - Existing data has invalid references that need to be cleaned up
    
  2. Changes
    - Delete invalid data that references subworks instead of subwork_items
    - Drop the incorrect foreign key constraint
    - Add the correct foreign key constraint pointing to `subwork_items.sr_no`
*/

-- Drop the incorrect foreign key constraint first
ALTER TABLE estimate.item_rate_analysis
DROP CONSTRAINT IF EXISTS item_rate_analysis_subwork_item_id_fkey;

-- Delete invalid data where subwork_item_id doesn't match any subwork_items.sr_no
DELETE FROM estimate.item_rate_analysis
WHERE subwork_item_id NOT IN (SELECT sr_no FROM estimate.subwork_items);

-- Add the correct foreign key constraint
ALTER TABLE estimate.item_rate_analysis
ADD CONSTRAINT item_rate_analysis_subwork_item_id_fkey 
FOREIGN KEY (subwork_item_id) 
REFERENCES estimate.subwork_items(sr_no) 
ON DELETE CASCADE;
