@@ .. @@
 /*
   # Create Measurement Book Table
   
   1. New Tables
     - `measurement_book`
-      - `id` (uuid, primary key)
+      - `sr_no` (serial, primary key)
       - `work_id` (text, references works.works_id)
       - `subwork_id` (text, references subworks.subworks_id)
-      - `item_id` (uuid, references subwork_items.id)
+      - `item_id` (text, references subwork_items.id)
       - `measurement_sr_no` (integer)
       - `description_of_items` (text)
       - `no_of_units` (integer)
       - `length` (decimal)
       - `width_breadth` (decimal)
       - `height_depth` (decimal)
       - `estimated_quantity` (decimal)
       - `actual_quantity` (decimal)
       - `variance` (decimal)
       - `variance_reason` (text)
       - `unit` (text)
-      - `measured_by` (uuid, references auth.users.id)
+      - `measured_by` (text, references auth.users.id)
       - `measured_at` (timestamptz)
       - `created_at` (timestamptz)
       - `updated_at` (timestamptz)
   
   2. Security
     - Enable RLS on `measurement_book` table
     - Add policies for users to manage their own measurements
     - Add policies for admins to view all measurements
   
   3. Indexes
     - Index on work_id for fast work-based queries
     - Index on subwork_id for subwork filtering
     - Index on item_id for item-based lookups
     - Index on measured_by for user-based queries
 */

 CREATE TABLE IF NOT EXISTS measurement_book (
-  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  sr_no SERIAL PRIMARY KEY,
   work_id TEXT NOT NULL,
   subwork_id TEXT NOT NULL,
-  item_id UUID NOT NULL,
+  item_id TEXT NOT NULL,
   measurement_sr_no INTEGER NOT NULL DEFAULT 1,
   description_of_items TEXT,
   no_of_units INTEGER DEFAULT 1,
   length DECIMAL(10,3) DEFAULT 0,
   width_breadth DECIMAL(10,3) DEFAULT 0,
   height_depth DECIMAL(10,3) DEFAULT 0,
   estimated_quantity DECIMAL(10,3) DEFAULT 0,
   actual_quantity DECIMAL(10,3) DEFAULT 0,
   variance DECIMAL(10,3) DEFAULT 0,
   variance_reason TEXT,
   unit TEXT,
-  measured_by UUID REFERENCES auth.users(id),
+  measured_by TEXT,
   measured_at TIMESTAMPTZ DEFAULT NOW(),
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );

 -- Add foreign key constraints
 ALTER TABLE measurement_book 
   ADD CONSTRAINT fk_measurement_book_work 
   FOREIGN KEY (work_id) REFERENCES estimate.works(works_id) ON DELETE CASCADE;

 ALTER TABLE measurement_book 
   ADD CONSTRAINT fk_measurement_book_subwork 
   FOREIGN KEY (subwork_id) REFERENCES estimate.subworks(subworks_id) ON DELETE CASCADE;

 ALTER TABLE measurement_book 
   ADD CONSTRAINT fk_measurement_book_item 
   FOREIGN KEY (item_id) REFERENCES estimate.subwork_items(id) ON DELETE CASCADE;

 -- Enable Row Level Security
 ALTER TABLE measurement_book ENABLE ROW LEVEL SECURITY;

 -- Create policies
 CREATE POLICY "Users can read own measurements"
   ON measurement_book
   FOR SELECT
   TO authenticated
-  USING (measured_by = auth.uid());
+  USING (measured_by = auth.email());

 CREATE POLICY "Users can insert own measurements"
   ON measurement_book
   FOR INSERT
   TO authenticated
-  WITH CHECK (measured_by = auth.uid());
+  WITH CHECK (measured_by = auth.email());

 CREATE POLICY "Users can update own measurements"
   ON measurement_book
   FOR UPDATE
   TO authenticated
-  USING (measured_by = auth.uid())
-  WITH CHECK (measured_by = auth.uid());
+  USING (measured_by = auth.email())
+  WITH CHECK (measured_by = auth.email());

 CREATE POLICY "Admins can manage all measurements"
   ON measurement_book
   FOR ALL
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
-      WHERE ur.user_id = auth.uid() 
+      WHERE ur.user_id = (SELECT id FROM auth.users WHERE email = auth.email())
       AND r.name IN ('super_admin', 'admin', 'developer')
     )
   )
   WITH CHECK (
     EXISTS (
       SELECT 1 FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
-      WHERE ur.user_id = auth.uid() 
+      WHERE ur.user_id = (SELECT id FROM auth.users WHERE email = auth.email())
       AND r.name IN ('super_admin', 'admin', 'developer')
     )
   );

 -- Create indexes for performance
 CREATE INDEX IF NOT EXISTS idx_measurement_book_work_id ON measurement_book(work_id);
 CREATE INDEX IF NOT EXISTS idx_measurement_book_subwork_id ON measurement_book(subwork_id);
 CREATE INDEX IF NOT EXISTS idx_measurement_book_item_id ON measurement_book(item_id);
 CREATE INDEX IF NOT EXISTS idx_measurement_book_measured_by ON measurement_book(measured_by);
 CREATE INDEX IF NOT EXISTS idx_measurement_book_measured_at ON measurement_book(measured_at);

 -- Create trigger for updating updated_at timestamp
 CREATE OR REPLACE FUNCTION update_measurement_book_updated_at()
 RETURNS TRIGGER AS $$
 BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
 END;
 $$ LANGUAGE plpgsql;

 CREATE TRIGGER update_measurement_book_updated_at
   BEFORE UPDATE ON measurement_book
   FOR EACH ROW
   EXECUTE FUNCTION update_measurement_book_updated_at();