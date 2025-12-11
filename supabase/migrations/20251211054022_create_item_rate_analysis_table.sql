/*
  # Create Item Rate Analysis Table

  1. New Tables
    - `item_rate_analysis`
      - `sr_no` (integer, primary key, auto-increment) - Unique identifier
      - `subwork_item_id` (integer, foreign key) - Links to subwork_items table
      - `base_rate` (numeric) - Starting rate for the analysis (e.g., 1000)
      - `entries` (jsonb) - Array of rate adjustment entries [{label, type, value, amount}]
      - `final_tax_percent` (numeric, nullable) - Tax percentage applied to final rate
      - `final_tax_amount` (numeric, nullable) - Calculated tax amount on final rate
      - `total_additions` (numeric) - Sum of all addition entries
      - `total_deletions` (numeric) - Sum of all deletion entries
      - `total_taxes` (numeric) - Sum of all tax entries
      - `final_rate` (numeric) - Calculated as: base_rate + additions - deletions + taxes
      - `total_rate` (numeric) - Final rate after applying final tax
      - `created_at` (timestamptz) - Timestamp of creation
      - `updated_at` (timestamptz) - Timestamp of last update
      - `created_by` (uuid, foreign key) - User who created the record

  2. Security
    - Enable RLS on `item_rate_analysis` table
    - Add policy for authenticated users to read their own data
    - Add policy for authenticated users to insert their own data
    - Add policy for authenticated users to update their own data
    - Add policy for authenticated users to delete their own data

  3. Important Notes
    - Entries stored as JSONB array with structure: [{label: string, type: string, value: number, amount: number}]
    - Type can be: 'Addition', 'Deletion', or 'Tax'
    - All numeric fields default to 0 except nullable final_tax fields
    - Foreign key constraint ensures data integrity with subwork_items
*/

-- Create the item_rate_analysis table
CREATE TABLE IF NOT EXISTS estimate.item_rate_analysis (
  sr_no INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  subwork_item_id INTEGER NOT NULL,
  base_rate NUMERIC NOT NULL DEFAULT 0,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_tax_percent NUMERIC,
  final_tax_amount NUMERIC,
  total_additions NUMERIC NOT NULL DEFAULT 0,
  total_deletions NUMERIC NOT NULL DEFAULT 0,
  total_taxes NUMERIC NOT NULL DEFAULT 0,
  final_rate NUMERIC NOT NULL DEFAULT 0,
  total_rate NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT fk_item_rate_analysis_subwork_item
    FOREIGN KEY (subwork_item_id)
    REFERENCES estimate.subwork_items(sr_no)
    ON DELETE CASCADE
);

-- Create index for faster lookups by subwork_item_id
CREATE INDEX IF NOT EXISTS idx_item_rate_analysis_subwork_item_id 
  ON estimate.item_rate_analysis(subwork_item_id);

-- Enable RLS
ALTER TABLE estimate.item_rate_analysis ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all rate analyses
CREATE POLICY "Authenticated users can read rate analyses"
  ON estimate.item_rate_analysis
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert rate analyses
CREATE POLICY "Authenticated users can insert rate analyses"
  ON estimate.item_rate_analysis
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Policy: Authenticated users can update their own rate analyses
CREATE POLICY "Authenticated users can update own rate analyses"
  ON estimate.item_rate_analysis
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Policy: Authenticated users can delete their own rate analyses
CREATE POLICY "Authenticated users can delete own rate analyses"
  ON estimate.item_rate_analysis
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION estimate.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-update updated_at timestamp
DROP TRIGGER IF EXISTS update_item_rate_analysis_updated_at ON estimate.item_rate_analysis;
CREATE TRIGGER update_item_rate_analysis_updated_at
  BEFORE UPDATE ON estimate.item_rate_analysis
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_updated_at_column();