/*
  # Create subwork_design_photos table

  1. New Tables
    - `subwork_design_photos`
      - `id` (uuid, primary key)
      - `subwork_id` (text, references subworks.subworks_id)
      - `photo_url` (text, photo URL from storage)
      - `photo_name` (text, original filename)
      - `file_size` (bigint, file size in bytes)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `subwork_design_photos` table
    - Add policies for users to manage their own photos
    - Add policies for admins to manage all photos

  3. Indexes
    - Index on subwork_id for efficient queries
    - Index on created_by for user-specific queries
*/

-- Create the subwork_design_photos table in estimate schema
CREATE TABLE IF NOT EXISTS estimate.subwork_design_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subwork_id text NOT NULL,
  photo_url text NOT NULL,
  photo_name text,
  file_size bigint,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE estimate.subwork_design_photos ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subwork_design_photos_subwork_id 
  ON estimate.subwork_design_photos(subwork_id);

CREATE INDEX IF NOT EXISTS idx_subwork_design_photos_created_by 
  ON estimate.subwork_design_photos(created_by);

-- RLS Policies

-- Users can read photos for subworks they have access to
CREATE POLICY "Users can read own subwork design photos"
  ON estimate.subwork_design_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.subworks sw
      WHERE sw.subworks_id = subwork_design_photos.subwork_id
      AND sw.created_by = auth.uid()
    )
  );

-- Users can insert photos for their own subworks
CREATE POLICY "Users can insert photos for own subworks"
  ON estimate.subwork_design_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM estimate.subworks sw
      WHERE sw.subworks_id = subwork_design_photos.subwork_id
      AND sw.created_by = auth.uid()
    )
  );

-- Users can delete their own photos
CREATE POLICY "Users can delete own photos"
  ON estimate.subwork_design_photos
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Admins can manage all photos
CREATE POLICY "Admins can manage all design photos"
  ON estimate.subwork_design_photos
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