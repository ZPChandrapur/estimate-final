/*
  # Fix Works Delete Cascades

  1. Changes
    - Drop existing foreign key constraint on measurement_book.work_id
    - Add new foreign key constraint with ON DELETE CASCADE
    - This ensures that when a work is deleted, all related measurement_book entries are also deleted

  2. Security
    - No RLS changes needed
*/

-- Drop existing foreign key constraint
ALTER TABLE estimate.measurement_book 
DROP CONSTRAINT IF EXISTS fk_measurement_book_work_id;

-- Add new foreign key constraint with CASCADE
ALTER TABLE estimate.measurement_book
ADD CONSTRAINT fk_measurement_book_work_id
FOREIGN KEY (work_id) 
REFERENCES estimate.works(works_id) 
ON DELETE CASCADE;