/*
  # Fix process_approval_action accessibility
  
  ## Overview
  Create a wrapper function in the public schema that calls the estimate schema function.
  This allows the Supabase client's rpc() method to find and call the function.
  
  ## Changes
  - Creates public.process_approval_action that calls estimate.process_approval_action
  - Maintains all security and logic from the original function
*/

-- Create wrapper function in public schema
CREATE OR REPLACE FUNCTION public.process_approval_action(
  p_workflow_id uuid,
  p_action text,
  p_comments text DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  -- Call the actual function in estimate schema
  RETURN estimate.process_approval_action(p_workflow_id, p_action, p_comments);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.process_approval_action(uuid, text, text) TO authenticated;