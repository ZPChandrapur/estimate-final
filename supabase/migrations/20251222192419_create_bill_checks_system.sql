/*
  # Add Bill Checks System for RA Bills

  1. New Tables
    - `mb_bill_check_types`
      - Stores different types of checks (e.g., "Accepted By Contractor", "Physically verified By EE")
      - Each check type has a percentage that will be applied to the bill amount
      - `id` (uuid, primary key)
      - `check_name` (text) - Name of the check
      - `percentage` (numeric) - Percentage to calculate from bill amount
      - `display_order` (integer) - Order to display checks
      - `is_active` (boolean) - Whether this check is currently active
      
    - `mb_bill_check_values`
      - Links bills to their applicable checks
      - Stores whether each check is completed/checked
      - `id` (uuid, primary key)
      - `bill_id` (uuid, foreign key to mb_bills)
      - `check_type_id` (uuid, foreign key to mb_bill_check_types)
      - `is_checked` (boolean) - Whether this check is completed
      - `checked_by` (uuid) - User who checked
      - `checked_at` (timestamptz) - When it was checked
      - `calculated_amount` (numeric) - Percentage amount calculated
      
  2. Default Check Types
    - Insert default check types for RA Bills workflow
    
  3. Security
    - Enable RLS on both tables
    - Add policies for authenticated users based on role assignments
    
  4. Triggers
    - Auto-create check values when bill is created
    - Auto-update check amounts when bill total changes
*/

-- Create bill check types table
CREATE TABLE IF NOT EXISTS estimate.mb_bill_check_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name text NOT NULL,
  percentage numeric NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  display_order integer NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bill check values table
CREATE TABLE IF NOT EXISTS estimate.mb_bill_check_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES estimate.mb_bills(id) ON DELETE CASCADE,
  check_type_id uuid NOT NULL REFERENCES estimate.mb_bill_check_types(id) ON DELETE CASCADE,
  is_checked boolean DEFAULT false,
  checked_by uuid REFERENCES auth.users(id),
  checked_at timestamptz,
  calculated_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(bill_id, check_type_id)
);

-- Insert default check types
INSERT INTO estimate.mb_bill_check_types (check_name, percentage, display_order)
VALUES 
  ('Accepted By Contractor', 10, 1),
  ('Physically verified and checked By EE', 10, 2)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE estimate.mb_bill_check_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate.mb_bill_check_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mb_bill_check_types
CREATE POLICY "Authenticated users can view check types"
  ON estimate.mb_bill_check_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Superadmins and Developers can manage check types"
  ON estimate.mb_bill_check_types
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles WHERE name IN ('superadmin', 'developer')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles WHERE name IN ('superadmin', 'developer')
      )
    )
  );

-- RLS Policies for mb_bill_check_values
CREATE POLICY "Users can view check values for their assigned projects"
  ON estimate.mb_bill_check_values
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.mb_bills
      INNER JOIN estimate.mb_work_role_assignments ON mb_work_role_assignments.project_id = mb_bills.project_id
      WHERE mb_bills.id = mb_bill_check_values.bill_id
      AND mb_work_role_assignments.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles WHERE name IN ('superadmin', 'developer')
      )
    )
  );

CREATE POLICY "Users can manage check values for their assigned projects"
  ON estimate.mb_bill_check_values
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.mb_bills
      INNER JOIN estimate.mb_work_role_assignments ON mb_work_role_assignments.project_id = mb_bills.project_id
      WHERE mb_bills.id = mb_bill_check_values.bill_id
      AND mb_work_role_assignments.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles WHERE name IN ('superadmin', 'developer')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimate.mb_bills
      INNER JOIN estimate.mb_work_role_assignments ON mb_work_role_assignments.project_id = mb_bills.project_id
      WHERE mb_bills.id = mb_bill_check_values.bill_id
      AND mb_work_role_assignments.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles WHERE name IN ('superadmin', 'developer')
      )
    )
  );

-- Function to auto-create check values when a bill is created
CREATE OR REPLACE FUNCTION estimate.create_bill_check_values()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert check values for all active check types
  INSERT INTO estimate.mb_bill_check_values (bill_id, check_type_id, calculated_amount)
  SELECT 
    NEW.id,
    ct.id,
    ROUND((NEW.total_amount * ct.percentage / 100), 2)
  FROM estimate.mb_bill_check_types ct
  WHERE ct.is_active = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create check values
DROP TRIGGER IF EXISTS trigger_create_bill_check_values ON estimate.mb_bills;
CREATE TRIGGER trigger_create_bill_check_values
  AFTER INSERT ON estimate.mb_bills
  FOR EACH ROW
  EXECUTE FUNCTION estimate.create_bill_check_values();

-- Function to recalculate check amounts when bill amount changes
CREATE OR REPLACE FUNCTION estimate.update_bill_check_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update calculated amounts if bill total changed
  IF NEW.total_amount != OLD.total_amount THEN
    UPDATE estimate.mb_bill_check_values
    SET calculated_amount = ROUND((NEW.total_amount * ct.percentage / 100), 2)
    FROM estimate.mb_bill_check_types ct
    WHERE mb_bill_check_values.bill_id = NEW.id
    AND mb_bill_check_values.check_type_id = ct.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update check amounts when bill changes
DROP TRIGGER IF EXISTS trigger_update_bill_check_amounts ON estimate.mb_bills;
CREATE TRIGGER trigger_update_bill_check_amounts
  AFTER UPDATE ON estimate.mb_bills
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_bill_check_amounts();
