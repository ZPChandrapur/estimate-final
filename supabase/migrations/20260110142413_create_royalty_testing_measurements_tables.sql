/*
  # Create Royalty and Testing Measurements Tables

  1. New Tables
    - `royalty_measurements`
      - `sr_no` (integer, primary key, auto-increment) - Unique identifier
      - `works_id` (text, foreign key) - Links to works table
      - `subwork_id` (integer, foreign key) - Links to subworks table
      - `subwork_item_id` (integer, foreign key) - Links to subwork_items table
      - `measurement` (numeric) - Final calculated quantity from item_measurements
      - `metal_factor` (numeric) - Multiplication factor for metal calculation
      - `hb_metal` (numeric) - Calculated as: measurement * metal_factor
      - `murum_factor` (numeric) - Multiplication factor for murum calculation
      - `murum` (numeric) - Calculated as: measurement * murum_factor
      - `sand_factor` (numeric) - Multiplication factor for sand calculation
      - `sand` (numeric) - Calculated as: measurement * sand_factor
      - `created_at` (timestamptz) - Timestamp of creation
      - `updated_at` (timestamptz) - Timestamp of last update
      - `created_by` (uuid, foreign key) - User who created the record

    - `testing_measurements`
      - Same structure as royalty_measurements
      - Used for quality control tests and testing frequency calculations

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read all data
    - Add policies for authenticated users to insert their own data
    - Add policies for authenticated users to update their own data
    - Add policies for authenticated users to delete their own data

  3. Important Notes
    - Only items with rate analysis from lead statement should appear in these tables
    - Measurement column contains the final calculated quantity from item_measurements
    - Calculated columns (hb_metal, murum, sand) are auto-computed based on factors
    - Foreign key constraints ensure data integrity
*/

-- Create the royalty_measurements table
CREATE TABLE IF NOT EXISTS estimate.royalty_measurements (
  sr_no INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  works_id TEXT NOT NULL,
  subwork_id INTEGER NOT NULL,
  subwork_item_id INTEGER NOT NULL,
  measurement NUMERIC NOT NULL DEFAULT 0,
  metal_factor NUMERIC NOT NULL DEFAULT 0,
  hb_metal NUMERIC NOT NULL DEFAULT 0,
  murum_factor NUMERIC NOT NULL DEFAULT 0,
  murum NUMERIC NOT NULL DEFAULT 0,
  sand_factor NUMERIC NOT NULL DEFAULT 0,
  sand NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT fk_royalty_measurements_works
    FOREIGN KEY (works_id)
    REFERENCES estimate.works(works_id)
    ON DELETE CASCADE,
    
  CONSTRAINT fk_royalty_measurements_subwork
    FOREIGN KEY (subwork_id)
    REFERENCES estimate.subworks(sr_no)
    ON DELETE CASCADE,
    
  CONSTRAINT fk_royalty_measurements_subwork_item
    FOREIGN KEY (subwork_item_id)
    REFERENCES estimate.subwork_items(sr_no)
    ON DELETE CASCADE
);

-- Create the testing_measurements table
CREATE TABLE IF NOT EXISTS estimate.testing_measurements (
  sr_no INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  works_id TEXT NOT NULL,
  subwork_id INTEGER NOT NULL,
  subwork_item_id INTEGER NOT NULL,
  measurement NUMERIC NOT NULL DEFAULT 0,
  metal_factor NUMERIC NOT NULL DEFAULT 0,
  hb_metal NUMERIC NOT NULL DEFAULT 0,
  murum_factor NUMERIC NOT NULL DEFAULT 0,
  murum NUMERIC NOT NULL DEFAULT 0,
  sand_factor NUMERIC NOT NULL DEFAULT 0,
  sand NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT fk_testing_measurements_works
    FOREIGN KEY (works_id)
    REFERENCES estimate.works(works_id)
    ON DELETE CASCADE,
    
  CONSTRAINT fk_testing_measurements_subwork
    FOREIGN KEY (subwork_id)
    REFERENCES estimate.subworks(sr_no)
    ON DELETE CASCADE,
    
  CONSTRAINT fk_testing_measurements_subwork_item
    FOREIGN KEY (subwork_item_id)
    REFERENCES estimate.subwork_items(sr_no)
    ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_royalty_measurements_works_id 
  ON estimate.royalty_measurements(works_id);
  
CREATE INDEX IF NOT EXISTS idx_royalty_measurements_subwork_id 
  ON estimate.royalty_measurements(subwork_id);
  
CREATE INDEX IF NOT EXISTS idx_royalty_measurements_subwork_item_id 
  ON estimate.royalty_measurements(subwork_item_id);

CREATE INDEX IF NOT EXISTS idx_testing_measurements_works_id 
  ON estimate.testing_measurements(works_id);
  
CREATE INDEX IF NOT EXISTS idx_testing_measurements_subwork_id 
  ON estimate.testing_measurements(subwork_id);
  
CREATE INDEX IF NOT EXISTS idx_testing_measurements_subwork_item_id 
  ON estimate.testing_measurements(subwork_item_id);

-- Enable RLS on royalty_measurements
ALTER TABLE estimate.royalty_measurements ENABLE ROW LEVEL SECURITY;

-- Policies for royalty_measurements
CREATE POLICY "Authenticated users can read royalty measurements"
  ON estimate.royalty_measurements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert royalty measurements"
  ON estimate.royalty_measurements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update own royalty measurements"
  ON estimate.royalty_measurements
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete own royalty measurements"
  ON estimate.royalty_measurements
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Enable RLS on testing_measurements
ALTER TABLE estimate.testing_measurements ENABLE ROW LEVEL SECURITY;

-- Policies for testing_measurements
CREATE POLICY "Authenticated users can read testing measurements"
  ON estimate.testing_measurements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert testing measurements"
  ON estimate.testing_measurements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update own testing measurements"
  ON estimate.testing_measurements
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete own testing measurements"
  ON estimate.testing_measurements
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Add triggers to auto-update updated_at timestamp for royalty_measurements
DROP TRIGGER IF EXISTS update_royalty_measurements_updated_at ON estimate.royalty_measurements;
CREATE TRIGGER update_royalty_measurements_updated_at
  BEFORE UPDATE ON estimate.royalty_measurements
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_updated_at_column();

-- Add triggers to auto-update updated_at timestamp for testing_measurements
DROP TRIGGER IF EXISTS update_testing_measurements_updated_at ON estimate.testing_measurements;
CREATE TRIGGER update_testing_measurements_updated_at
  BEFORE UPDATE ON estimate.testing_measurements
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_updated_at_column();

-- Create trigger function to auto-calculate the computed columns for royalty_measurements
CREATE OR REPLACE FUNCTION estimate.calculate_royalty_measurements()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hb_metal := NEW.measurement * NEW.metal_factor;
  NEW.murum := NEW.measurement * NEW.murum_factor;
  NEW.sand := NEW.measurement * NEW.sand_factor;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-calculate royalty measurements
DROP TRIGGER IF EXISTS trigger_calculate_royalty_measurements ON estimate.royalty_measurements;
CREATE TRIGGER trigger_calculate_royalty_measurements
  BEFORE INSERT OR UPDATE ON estimate.royalty_measurements
  FOR EACH ROW
  EXECUTE FUNCTION estimate.calculate_royalty_measurements();

-- Create trigger function to auto-calculate the computed columns for testing_measurements
CREATE OR REPLACE FUNCTION estimate.calculate_testing_measurements()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hb_metal := NEW.measurement * NEW.metal_factor;
  NEW.murum := NEW.measurement * NEW.murum_factor;
  NEW.sand := NEW.measurement * NEW.sand_factor;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-calculate testing measurements
DROP TRIGGER IF EXISTS trigger_calculate_testing_measurements ON estimate.testing_measurements;
CREATE TRIGGER trigger_calculate_testing_measurements
  BEFORE INSERT OR UPDATE ON estimate.testing_measurements
  FOR EACH ROW
  EXECUTE FUNCTION estimate.calculate_testing_measurements();
