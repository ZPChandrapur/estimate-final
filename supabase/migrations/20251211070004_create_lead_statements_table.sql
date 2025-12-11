/*
  # Create Lead Statements Table

  1. New Tables
    - `lead_statements`
      - `id` (uuid, primary key)
      - `works_id` (text, foreign key to works table)
      - `sr_no` (integer) - Serial number
      - `material` (text) - Material name (e.g., Cement, Steel, Sand)
      - `reference` (text) - Location reference (e.g., Chandrapur, Andhari River)
      - `lead_in_km` (numeric) - Lead distance in kilometers
      - `lead_charges` (numeric) - Lead charges amount
      - `total_rate` (numeric) - Total rate per unit
      - `unit` (text) - Unit of measurement (e.g., /Bag, /M.T., /Cum)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `lead_statements` table
    - Add policies for authenticated users to manage their own lead statements
*/

CREATE TABLE IF NOT EXISTS estimate.lead_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  works_id text NOT NULL REFERENCES estimate.works(works_id) ON DELETE CASCADE,
  sr_no integer NOT NULL,
  material text NOT NULL,
  reference text,
  lead_in_km numeric(10, 2) DEFAULT 0,
  lead_charges numeric(10, 2) DEFAULT 0,
  total_rate numeric(10, 2) DEFAULT 0,
  unit text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(works_id, sr_no)
);

ALTER TABLE estimate.lead_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lead statements for their works"
  ON estimate.lead_statements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.works
      WHERE works.works_id = lead_statements.works_id
      AND works.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert lead statements for their works"
  ON estimate.lead_statements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimate.works
      WHERE works.works_id = lead_statements.works_id
      AND works.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update lead statements for their works"
  ON estimate.lead_statements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.works
      WHERE works.works_id = lead_statements.works_id
      AND works.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimate.works
      WHERE works.works_id = lead_statements.works_id
      AND works.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete lead statements for their works"
  ON estimate.lead_statements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.works
      WHERE works.works_id = lead_statements.works_id
      AND works.created_by = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_lead_statements_works_id ON estimate.lead_statements(works_id);
CREATE INDEX IF NOT EXISTS idx_lead_statements_created_by ON estimate.lead_statements(created_by);