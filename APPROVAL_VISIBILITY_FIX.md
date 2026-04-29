# Approval Workflow Visibility Fix

## Issue
Executive Engineer (and other role-based engineers) could not see pending approvals even though they have the appropriate role.

## Root Cause
The RLS (Row-Level Security) policy on `approval_workflows` table required users to either:
1. Be explicitly assigned to the work in `work_assignments` table
2. Be the current approver ID
3. Have admin/super_admin/developer role
4. Have initiated the workflow

This prevented role-based visibility - an Executive Engineer couldn't see a workflow that should go to Level 4 (Executive Engineer) unless they were explicitly assigned to that specific work.

## Solution
**Migration:** `20260429_fix_approval_workflow_visibility.sql`

Updated the RLS policy to include role-based visibility:
- Level 1 workflows → Visible to Junior Engineers (role_id 10)
- Level 2 workflows → Visible to Sub Division Engineers (role_id 15)  
- Level 3 workflows → Visible to Divisional Engineers (role_id 16)
- Level 4 workflows → Visible to Executive Engineers (role_id 17)

This allows engineers to see workflows at their approval level even if they're not explicitly assigned to that specific work.

## How to Apply

### Option 1: Manual SQL (Supabase Dashboard)
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the migration SQL
3. Click "Run"

### Option 2: Via Migrations
When deploying, ensure the migration `20260429_fix_approval_workflow_visibility.sql` runs.

## Expected Result
✅ Executive Engineer can now see pending approvals at their level
✅ All engineers can view workflows at their approval level
✅ Work assignments remain optional but still grant full access
✅ No breaking changes to existing functionality

## Testing
1. Log in as Executive Engineer
2. Go to "Approval Workflow" dashboard
3. Should see pending approvals at Level 4 (EE)
