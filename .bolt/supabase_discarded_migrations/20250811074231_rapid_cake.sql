/*
  # Create item_rates table for storing multiple rates per subwork item

  1. New Tables
    - `item_rates`
      - `sr_no` (serial, primary key)
      - `subwork_item_sr_no` (integer, foreign key to subwork_items.sr_no)
      - `description` (text, rate description/material name)
      - `rate` (numeric, rate amount)
      - `unit` (text, unit of measurement)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `created_by` (uuid, foreign key to auth.users)

  2. Security
    - Enable RLS on `item_rates` table
    - Add policies for authenticated users to manage their own rates
    - Add policies for admins to manage all rates

  3. Relationships
    - Foreign key to subwork_items(sr_no) with CASCADE delete
    - Foreign key to auth.users(id) for created_by
*/

-- Create the item_rates table
CREATE TABLE IF NOT EXISTS estimate.item_rates (
  sr_no SERIAL NOT NULL,
  subwork_item_sr_no INTEGER NOT NULL,
  description TEXT NOT NULL,
  rate NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  created_by UUID NULL,
  CONSTRAINT item_rates_pkey PRIMARY KEY (sr_no),
  CONSTRAINT item_rates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT item_rates_subwork_item_sr_no_fkey FOREIGN KEY (subwork_item_sr_no) REFERENCES estimate.subwork_items (sr_no) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_item_rates_subwork_item_sr_no ON estimate.item_rates (subwork_item_sr_no);
CREATE INDEX IF NOT EXISTS idx_item_rates_created_by ON estimate.item_rates (created_by);

-- Enable Row Level Security
ALTER TABLE estimate.item_rates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can read own item rates"
  ON estimate.item_rates
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      WHERE si.sr_no = item_rates.subwork_item_sr_no
      AND si.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own item rates"
  ON estimate.item_rates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      WHERE si.sr_no = item_rates.subwork_item_sr_no
      AND si.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own item rates"
  ON estimate.item_rates
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      WHERE si.sr_no = item_rates.subwork_item_sr_no
      AND si.created_by = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      WHERE si.sr_no = item_rates.subwork_item_sr_no
      AND si.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete own item rates"
  ON estimate.item_rates
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      WHERE si.sr_no = item_rates.subwork_item_sr_no
      AND si.created_by = auth.uid()
    )
  );

-- Admins can manage all item rates
CREATE POLICY "Admins can manage all item rates"
  ON estimate.item_rates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'developer')
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_item_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_item_rates_updated_at
  BEFORE UPDATE ON estimate.item_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_item_rates_updated_at();