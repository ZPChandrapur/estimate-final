/*
  # Create subwork design photos table

  1. New Tables
    - `subwork_design_photos`
      - `id` (uuid, primary key)
      - `subwork_id` (text, foreign key to subworks.subworks_id)
      - `photo_url` (text, URL to photo in storage)
      - `photo_name` (text, original filename)
      - `file_size` (bigint, file size in bytes)
      - `created_at` (timestamp)
      - `created_by` (uuid, foreign key to users)

  2. Security
    - Enable RLS on `subwork_design_photos` table
    - Add policies for users to manage their own photos
    - Add policies for admins to view all photos

  3. Storage
    - References estimate-designs bucket
    - Maximum 5 photos per subwork
*/

CREATE TABLE IF NOT EXISTS estimate.subwork_design_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subwork_id text NOT NULL,
  photo_url text NOT NULL,
  photo_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT fk_subwork_design_photos_subwork 
    FOREIGN KEY (subwork_id) 
    REFERENCES estimate.subworks(subworks_id) 
    ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE estimate.subwork_design_photos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own subwork design photos"
  ON estimate.subwork_design_photos
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM estimate.subworks s
      WHERE s.subworks_id = subwork_design_photos.subwork_id
      AND s.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own subwork design photos"
  ON estimate.subwork_design_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM estimate.subworks s
      WHERE s.subworks_id = subwork_design_photos.subwork_id
      AND s.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete own subwork design photos"
  ON estimate.subwork_design_photos
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM estimate.subworks s
      WHERE s.subworks_id = subwork_design_photos.subwork_id
      AND s.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all subwork design photos"
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
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subwork_design_photos_subwork_id 
  ON estimate.subwork_design_photos(subwork_id);

CREATE INDEX IF NOT EXISTS idx_subwork_design_photos_created_by 
  ON estimate.subwork_design_photos(created_by);

CREATE INDEX IF NOT EXISTS idx_subwork_design_photos_created_at 
  ON estimate.subwork_design_photos(created_at DESC);