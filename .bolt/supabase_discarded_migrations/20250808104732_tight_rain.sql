/*
  # Enhanced Subworks Structure

  1. New Tables
    - `subwork_items` - Individual items within subworks with SSR details
    - `item_measurements` - Detailed measurements for quantity calculations
    - `item_leads` - Lead charges for materials transportation
    - `item_materials` - Material requirements and costs

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their own data
    - Add policies for admins to manage all data

  3. Relationships
    - subwork_items → subworks (many-to-one)
    - item_measurements/leads/materials → subwork_items (many-to-one)
*/

-- Create subwork_items table in estimate schema
CREATE TABLE IF NOT EXISTS estimate.subwork_items (
  sr_no SERIAL PRIMARY KEY,
  subwork_id TEXT NOT NULL REFERENCES estimate.subworks(subworks_id) ON DELETE CASCADE,
  item_number TEXT NOT NULL,
  category TEXT,
  description_of_item TEXT NOT NULL,
  ssr_quantity DECIMAL(10,3) DEFAULT 0,
  ssr_rate DECIMAL(10,2) DEFAULT 0,
  ssr_unit TEXT,
  total_item_amount DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create item_measurements table in estimate schema
CREATE TABLE IF NOT EXISTS estimate.item_measurements (
  sr_no SERIAL PRIMARY KEY,
  subwork_item_id INTEGER NOT NULL REFERENCES estimate.subwork_items(sr_no) ON DELETE CASCADE,
  measurement_sr_no INTEGER NOT NULL,
  ssr_reference TEXT,
  works_number TEXT,
  sub_works_number TEXT,
  description_of_items TEXT,
  sub_description TEXT,
  no_of_units DECIMAL(10,3) DEFAULT 0,
  length DECIMAL(10,3) DEFAULT 0,
  width_breadth DECIMAL(10,3) DEFAULT 0,
  height_depth DECIMAL(10,3) DEFAULT 0,
  calculated_quantity DECIMAL(15,6) DEFAULT 0,
  unit TEXT,
  line_amount DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create item_leads table in estimate schema
CREATE TABLE IF NOT EXISTS estimate.item_leads (
  sr_no SERIAL PRIMARY KEY,
  subwork_item_id INTEGER NOT NULL REFERENCES estimate.subwork_items(sr_no) ON DELETE CASCADE,
  lead_sr_no INTEGER NOT NULL,
  material TEXT NOT NULL,
  location_of_quarry TEXT,
  lead_in_km DECIMAL(8,2) DEFAULT 0,
  lead_charges DECIMAL(10,2) DEFAULT 0,
  initial_lead_charges DECIMAL(10,2) DEFAULT 0,
  net_lead_charges DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create item_materials table in estimate schema
CREATE TABLE IF NOT EXISTS estimate.item_materials (
  sr_no SERIAL PRIMARY KEY,
  subwork_item_id INTEGER NOT NULL REFERENCES estimate.subwork_items(sr_no) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  required_quantity DECIMAL(10,3) DEFAULT 0,
  unit TEXT,
  rate_per_unit DECIMAL(10,2) DEFAULT 0,
  total_material_cost DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subwork_items_subwork_id ON estimate.subwork_items(subwork_id);
CREATE INDEX IF NOT EXISTS idx_item_measurements_subwork_item_id ON estimate.item_measurements(subwork_item_id);
CREATE INDEX IF NOT EXISTS idx_item_leads_subwork_item_id ON estimate.item_leads(subwork_item_id);
CREATE INDEX IF NOT EXISTS idx_item_materials_subwork_item_id ON estimate.item_materials(subwork_item_id);

-- Enable Row Level Security
ALTER TABLE estimate.subwork_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate.item_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate.item_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate.item_materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subwork_items
CREATE POLICY "Users can manage own subwork items"
  ON estimate.subwork_items
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can manage all subwork items"
  ON estimate.subwork_items
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

-- RLS Policies for item_measurements
CREATE POLICY "Users can manage own item measurements"
  ON estimate.item_measurements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      WHERE si.sr_no = item_measurements.subwork_item_id
      AND si.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all item measurements"
  ON estimate.item_measurements
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

-- RLS Policies for item_leads
CREATE POLICY "Users can manage own item leads"
  ON estimate.item_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      WHERE si.sr_no = item_leads.subwork_item_id
      AND si.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all item leads"
  ON estimate.item_leads
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

-- RLS Policies for item_materials
CREATE POLICY "Users can manage own item materials"
  ON estimate.item_materials
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.subwork_items si
      WHERE si.sr_no = item_materials.subwork_item_id
      AND si.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all item materials"
  ON estimate.item_materials
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

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subwork_items_updated_at
    BEFORE UPDATE ON estimate.subwork_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();