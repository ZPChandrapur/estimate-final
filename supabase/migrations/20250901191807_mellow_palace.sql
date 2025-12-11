/*
  # Move estimate_templates table to estimate schema

  1. New Tables in estimate schema
    - `estimate_templates`
      - `id` (uuid, primary key)
      - `template_name` (text, not null)
      - `description` (text, optional)
      - `original_works_id` (text, not null)
      - `template_data` (jsonb, not null)
      - `created_by` (uuid, references users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `estimate_templates` table
    - Add policies for users to manage their own templates

  3. Indexes
    - Index on created_by for performance
    - Index on created_at for sorting
*/

-- Create estimate_templates table in estimate schema
CREATE TABLE IF NOT EXISTS estimate.estimate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  description text,
  original_works_id text NOT NULL,
  template_data jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE estimate.estimate_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create templates"
  ON estimate.estimate_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can read own templates"
  ON estimate.estimate_templates
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can update own templates"
  ON estimate.estimate_templates
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own templates"
  ON estimate.estimate_templates
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_estimate_templates_created_by 
  ON estimate.estimate_templates (created_by);

CREATE INDEX IF NOT EXISTS idx_estimate_templates_created_at 
  ON estimate.estimate_templates (created_at DESC);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION estimate.update_estimate_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_estimate_templates_updated_at
  BEFORE UPDATE ON estimate.estimate_templates
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_estimate_templates_updated_at();

-- Drop the old table if it exists in public schema
DROP TABLE IF EXISTS public.estimate_templates;