/*
  # Enhanced Subworks Structure

  1. New Tables
    - `subwork_items` - Individual items within subworks with SSR details
    - `item_measurements` - Detailed measurements for quantity calculations
    - `item_leads` - Lead charges for materials transportation
    - `item_materials` - Material requirements and costs

  2. Relationships
    - subwork_items -> subworks (many-to-one)
    - item_measurements -> subwork_items (many-to-one)
    - item_leads -> subwork_items (many-to-one)
    - item_materials -> subwork_items (many-to-one)

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- 1. Subwork Items Table
CREATE TABLE IF NOT EXISTS subwork_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subwork_id uuid REFERENCES subworks(id) ON DELETE CASCADE,
  item_number text NOT NULL,
  category text,
  description_of_item text NOT NULL,
  ssr_quantity numeric(15,3) DEFAULT 0,
  ssr_rate numeric(15,2) DEFAULT 0,
  ssr_unit text,
  total_item_amount numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);

-- 2. Item Measurements Table
CREATE TABLE IF NOT EXISTS item_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subwork_item_id uuid REFERENCES subwork_items(id) ON DELETE CASCADE,
  sr_no integer NOT NULL,
  ssr_reference text,
  works_number text,
  sub_works_number text,
  description_of_items text,
  sub_description text,
  no_of_units numeric(10,2) DEFAULT 1,
  length numeric(10,3) DEFAULT 0,
  width_breadth numeric(10,3) DEFAULT 0,
  height_depth numeric(10,3) DEFAULT 0,
  calculated_quantity numeric(15,3) DEFAULT 0,
  unit text,
  line_amount numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Item Leads Table
CREATE TABLE IF NOT EXISTS item_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subwork_item_id uuid REFERENCES subwork_items(id) ON DELETE CASCADE,
  sr_no integer NOT NULL,
  material text NOT NULL,
  location_of_quarry text,
  lead_in_km numeric(8,2) DEFAULT 0,
  lead_charges numeric(10,2) DEFAULT 0,
  initial_lead_charges numeric(10,2) DEFAULT 0,
  net_lead_charges numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Item Materials Table
CREATE TABLE IF NOT EXISTS item_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subwork_item_id uuid REFERENCES subwork_items(id) ON DELETE CASCADE,
  material_name text NOT NULL,
  required_quantity numeric(15,3) DEFAULT 0,
  unit text,
  rate_per_unit numeric(10,2) DEFAULT 0,
  total_material_cost numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subwork_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subwork_items
CREATE POLICY "Users can read own subwork items"
  ON subwork_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subworks s
      JOIN works w ON s.works_id = w.works_id
      WHERE s.id = subwork_items.subwork_id
      AND (w.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'developer')
      ))
    )
  );

CREATE POLICY "Users can manage own subwork items"
  ON subwork_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subworks s
      JOIN works w ON s.works_id = w.works_id
      WHERE s.id = subwork_items.subwork_id
      AND (w.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'developer')
      ))
    )
  );

-- RLS Policies for item_measurements
CREATE POLICY "Users can read own item measurements"
  ON item_measurements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subwork_items si
      JOIN subworks s ON si.subwork_id = s.id
      JOIN works w ON s.works_id = w.works_id
      WHERE si.id = item_measurements.subwork_item_id
      AND (w.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'developer')
      ))
    )
  );

CREATE POLICY "Users can manage own item measurements"
  ON item_measurements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subwork_items si
      JOIN subworks s ON si.subwork_id = s.id
      JOIN works w ON s.works_id = w.works_id
      WHERE si.id = item_measurements.subwork_item_id
      AND (w.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'developer')
      ))
    )
  );

-- RLS Policies for item_leads
CREATE POLICY "Users can read own item leads"
  ON item_leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subwork_items si
      JOIN subworks s ON si.subwork_id = s.id
      JOIN works w ON s.works_id = w.works_id
      WHERE si.id = item_leads.subwork_item_id
      AND (w.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'developer')
      ))
    )
  );

CREATE POLICY "Users can manage own item leads"
  ON item_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subwork_items si
      JOIN subworks s ON si.subwork_id = s.id
      JOIN works w ON s.works_id = w.works_id
      WHERE si.id = item_leads.subwork_item_id
      AND (w.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'developer')
      ))
    )
  );

-- RLS Policies for item_materials
CREATE POLICY "Users can read own item materials"
  ON item_materials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subwork_items si
      JOIN subworks s ON si.subwork_id = s.id
      JOIN works w ON s.works_id = w.works_id
      WHERE si.id = item_materials.subwork_item_id
      AND (w.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'developer')
      ))
    )
  );

CREATE POLICY "Users can manage own item materials"
  ON item_materials
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subwork_items si
      JOIN subworks s ON si.subwork_id = s.id
      JOIN works w ON s.works_id = w.works_id
      WHERE si.id = item_materials.subwork_item_id
      AND (w.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'developer')
      ))
    )
  );

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subwork_items_updated_at
    BEFORE UPDATE ON subwork_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_measurements_updated_at
    BEFORE UPDATE ON item_measurements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subwork_items_subwork_id ON subwork_items(subwork_id);
CREATE INDEX IF NOT EXISTS idx_item_measurements_subwork_item_id ON item_measurements(subwork_item_id);
CREATE INDEX IF NOT EXISTS idx_item_leads_subwork_item_id ON item_leads(subwork_item_id);
CREATE INDEX IF NOT EXISTS idx_item_materials_subwork_item_id ON item_materials(subwork_item_id);