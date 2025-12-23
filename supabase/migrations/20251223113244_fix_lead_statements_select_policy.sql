/*
  # Fix Lead Statements SELECT Policy for Rate Analysis
  
  1. Problem
    - Lead statements SELECT policy is too restrictive
    - Users can only view lead statements for works they created or are assigned to
    - This prevents the Rate Analysis search feature from working
    - Lead statements should be viewable by all authenticated users as reference data
    
  2. Changes
    - Drop existing SELECT policy for lead_statements
    - Create new SELECT policy allowing all authenticated users to view
    - Keep INSERT, UPDATE, DELETE policies restrictive (assigned works only)
    
  3. Security
    - All authenticated users can view lead statements (similar to CSR, SSR tables)
    - Only assigned users can modify lead statements
    - This allows Rate Analysis search to work across all works
*/

-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view lead statements for their assigned works" ON estimate.lead_statements;

-- Create new open SELECT policy for all authenticated users
CREATE POLICY "Authenticated users can view all lead statements"
  ON estimate.lead_statements
  FOR SELECT
  TO authenticated
  USING (true);
