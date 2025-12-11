/*
  # Add CSR Reference Information to Subwork Items

  1. Changes
    - Add columns to `subwork_items` table to store CSR reference information:
      - `csr_item_no` (text) - CSR Item Number (e.g., "1-A", "2-B")
      - `csr_reference` (text) - CSR Page reference (e.g., "WDC CSR 22-23 Page 21 It. No. 1-A")
      - `csr_labour_cost` (numeric) - Labour cost from CSR
      - `csr_unit` (text) - Unit from CSR (e.g., "Cum", "M.T.")
      
  2. Purpose
    - Store complete CSR item details for reference in Rate Analysis
    - Enable proper tracking of base rates and their sources
    - Maintain audit trail of rate sources
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'estimate' 
    AND table_name = 'subwork_items' 
    AND column_name = 'csr_item_no'
  ) THEN
    ALTER TABLE estimate.subwork_items 
    ADD COLUMN csr_item_no text,
    ADD COLUMN csr_reference text,
    ADD COLUMN csr_labour_cost numeric(10, 2) DEFAULT 0,
    ADD COLUMN csr_unit text;
  END IF;
END $$;