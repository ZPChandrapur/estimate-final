/*
  # Create design photos table for estimate schema

  1. New Tables
    - `design_photos`
      - `id` (uuid, primary key)
      - `subwork_item_id` (integer, foreign key to subwork_items)
      - `photo_url` (text, URL to the uploaded photo)
      - `photo_name` (text, original filename)
      - `file_size` (integer, file size in bytes)
      - `created_at` (timestamp)
      - `created_by` (uuid, foreign key to users)

  2. Security
    - Enable RLS on `design_photos` table
    - Add policies for authenticated users to manage their own photos
    - Add policies for admins to read all photos

  3. Storage
    - Create estimate-designs bucket for photo storage
    - Set appropriate permissions for authenticated users
*/

-- Create design_photos table
CREATE TABLE IF NOT EXISTS estimate.design_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subwork_item_id integer NOT NULL,
  photo_url text NOT NULL,
  photo_name text NOT NULL,
  file_size integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT fk_design_photos_subwork_item 
    FOREIGN KEY (subwork_item_id) 
    REFERENCES estimate.subwork_items(sr_no) 
    ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE estimate.design_photos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own design photos"
  ON estimate.design_photos
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert own design photos"
  ON estimate.design_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own design photos"
  ON estimate.design_photos
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own design photos"
  ON estimate.design_photos
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Admin policies (assuming admin role exists)
CREATE POLICY "Admins can read all design photos"
  ON estimate.design_photos
  FOR SELECT
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
CREATE INDEX IF NOT EXISTS idx_design_photos_subwork_item 
  ON estimate.design_photos(subwork_item_id);

CREATE INDEX IF NOT EXISTS idx_design_photos_created_by 
  ON estimate.design_photos(created_by);

-- Create storage bucket (this needs to be done via Supabase dashboard or API)
-- The bucket 'estimate-designs' should be created with:
-- - Public: false (private bucket)
-- - File size limit: 5MB
-- - Allowed mime types: image/*