/*
  # Create Item Rates Table

  1. New Tables
    - `item_rates`
      - `id` (uuid, primary key)
      - `subwork_item_id` (text, references subwork_items)
      - `description` (text, rate description/material name)
      - `rate` (numeric, rate amount)
      - `unit` (text, unit of measurement)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `created_by` (uuid, references auth.users)

  2. Security
    - Enable RLS on `item_rates` table
    - Add policies for authenticated users

  3. Changes
    - This allows storing multiple rates per subwork item
    - Each rate can have its own description, amount, and unit
    - Maintains relationship with subwork_items table
*/

-- Create item_rates table
CREATE TABLE IF NOT EXISTS estimate.item_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subwork_item_id TEXT NOT NULL,
    description TEXT NOT NULL,
    rate NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Foreign key constraint (we'll reference by subwork_id + item_number since that's the composite key)
    CONSTRAINT fk_item_rates_subwork_item 
        FOREIGN KEY (subwork_item_id) 
        REFERENCES estimate.subwork_items(id) 
        ON DELETE CASCADE
);

-- Create trigger to update updated_at
CREATE TRIGGER trigger_update_item_rates_updated_at
    BEFORE UPDATE ON estimate.item_rates
    FOR EACH ROW
    EXECUTE FUNCTION estimate.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE estimate.item_rates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all item rates"
    ON estimate.item_rates
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert item rates"
    ON estimate.item_rates
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own item rates"
    ON estimate.item_rates
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own item rates"
    ON estimate.item_rates
    FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_item_rates_subwork_item_id ON estimate.item_rates(subwork_item_id);
CREATE INDEX IF NOT EXISTS idx_item_rates_created_by ON estimate.item_rates(created_by);
CREATE INDEX IF NOT EXISTS idx_item_rates_created_at ON estimate.item_rates(created_at);

-- Grant permissions to authenticated users
GRANT ALL ON estimate.item_rates TO authenticated;