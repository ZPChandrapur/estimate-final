/*
  # Add RLS Policies for Lead Charges and CSR Tables

  1. Security
    - Add SELECT policy for authenticated users on Lead_Charges_Materials_22-23 table
    - Add SELECT policy for authenticated users on CSR-2022-2023 table
    - These are reference/lookup tables that authenticated users need to read

  2. Notes
    - RLS was already enabled on these tables but no policies existed
    - This allows authenticated users to view the data
*/

-- Policy for Lead_Charges_Materials_22-23 table
CREATE POLICY "Authenticated users can view lead charges data"
  ON estimate."Lead_Charges_Materials_22-23"
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for CSR-2022-2023 table
CREATE POLICY "Authenticated users can view CSR data"
  ON estimate."CSR-2022-2023"
  FOR SELECT
  TO authenticated
  USING (true);
