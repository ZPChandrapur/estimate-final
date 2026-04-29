# TS Work Type Handling - Comprehensive Code Analysis Report

## Executive Summary
The codebase contains extensive support for TS (Technical Sanction) and TA (Technical Approval) work type differentiation at the **data model and UI layer**, but the **approval workflow system does NOT differentiate between TS and TA works**. Both use identical role hierarchies and approval processes.

---

## 1. WORK TYPE FIELD USAGE

### 1.1 Database Schema
**File:** `supabase/migrations/20260119064311_add_work_type_to_mb_projects.sql`

```sql
-- Work type field in mb_projects table
ALTER TABLE estimate.mb_projects ADD COLUMN work_type text DEFAULT 'TA' 
  CHECK (work_type IN ('TS', 'TA'));

-- Additional fields for work type documentation
ALTER TABLE estimate.mb_projects ADD COLUMN technical_sanction_no text;
ALTER TABLE estimate.mb_projects ADD COLUMN technical_approval_no text;
```

**Key Points:**
- `work_type` field stores 'TS' or 'TA'
- Default is 'TA' (Technical Approval)
- `technical_sanction_no` field for TS documentation
- `technical_approval_no` field for TA documentation

### 1.2 Works Table (in estimate schema)
**File:** `src/components/Works.tsx` (line 142, 325, 326, 495, 530, 582)

```typescript
// Works table has 'type' field
type: 'Technical Approval' | 'Technical Sanction'

// Type filtering in Works component
const matchesType = typeFilter === 'all' || work.type === typeFilter;
const matchesTab = work.type === tabTypeMap[activeTab];

// TS-specific button rendering
{work.estimate_status === 'approved' && work.type === 'Technical Sanction' ? (
  // Show "Promote to MB" button for approved TS works
) : null}

// TA-specific button rendering
{activeTab === 'ta' && work.estimate_status === 'approved' && work.type === 'Technical Approval' && (
  // Show "Promote to TS" button for approved TA works
)}
```

---

## 2. TS WORK PROMOTION LOGIC

### 2.1 handlePromoteToTS Function
**File:** `src/components/Works.tsx` (line 240)

```typescript
const handlePromoteToTS = async (work: Work) => {
  if (!confirm(`Promote "${work.work_name}" from Technical Approval to Technical Sanction?\n\n...`)) return;
  
  try {
    // 1. DELETE existing approval workflow + history for clean slate
    const { data: existingWf } = await supabase
      .schema('estimate').from('approval_workflows')
      .select('id').eq('work_id', work.works_id);

    if (existingWf && existingWf.length > 0) {
      const wfIds = existingWf.map(w => w.id);
      await supabase.schema('estimate').from('approval_history').delete().in('workflow_id', wfIds);
      await supabase.schema('estimate').from('approval_workflows').delete().eq('work_id', work.works_id);
    }

    // 2. UPDATE type to TS and reset status to draft
    const { error: updateError } = await supabase
      .schema('estimate').from('works')
      .update({ type: 'Technical Sanction', estimate_status: 'draft' })
      .eq('works_id', work.works_id);
    
    if (updateError) throw updateError;

    alert(`"${work.work_name}" has been promoted to Technical Sanction.\n...`);
    fetchWorks();
  } catch (error: any) {
    console.error('Error promoting to TS:', error);
    alert('Failed to promote: ' + error.message);
  }
};
```

**Key Points:**
- **Deletes existing approval workflows** when promoting to TS
- **Resets estimate_status to 'draft'** for fresh approval
- **Works ID remains same** - only type changes
- Preparation for new TS approval process

---

## 3. APPROVAL WORKFLOW SYSTEM

### ⚠️ CRITICAL: NO WORK TYPE DIFFERENTIATION IN APPROVAL FUNCTIONS

### 3.1 initiate_approval_workflow Function
**File:** `supabase/migrations/20260428202322_fix_initiate_workflow_on_resubmit.sql` (line 17)

```sql
CREATE OR REPLACE FUNCTION estimate.initiate_approval_workflow(
  p_work_id text  -- ← NO work_type parameter
)
RETURNS uuid AS $$
DECLARE
  v_workflow_id uuid;
  v_next_approver record;
  v_initiator_role integer;
  v_current_level integer;
  v_existing_status text;
BEGIN
  -- Block re-submission if workflow is still active
  SELECT status INTO v_existing_status
  FROM estimate.approval_workflows
  WHERE work_id = p_work_id;

  IF v_existing_status = 'pending_approval' THEN
    RAISE EXCEPTION 'This work already has an active approval workflow in progress.';
  END IF;

  IF v_existing_status = 'approved' THEN
    RAISE EXCEPTION 'This work has already been fully approved.';
  END IF;

  -- Get initiator's role from work_assignments
  SELECT role_id INTO v_initiator_role
  FROM estimate.work_assignments
  WHERE work_id = p_work_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_initiator_role IS NULL THEN
    RAISE EXCEPTION 'You are not assigned to this work. Please contact an administrator...';
  END IF;

  -- Calculate starting level based on initiator's role (SAME FOR TS AND TA)
  v_current_level := CASE v_initiator_role
    WHEN 10 THEN 1  -- JE submits, goes to level 2 (Sub Div)
    WHEN 15 THEN 2  -- Sub Div submits, goes to level 3 (Div)
    WHEN 16 THEN 3  -- Div submits, goes to level 4 (Exec)
    ELSE 1
  END;

  -- Get next approver (one level above initiator) - NO work_type check
  SELECT * INTO v_next_approver
  FROM estimate.get_next_approver(p_work_id, v_current_level);

  IF v_next_approver.user_id IS NULL THEN
    RAISE EXCEPTION 'No approver found for the next level. Please ensure a % is assigned to this work.',
      CASE v_current_level + 1
        WHEN 2 THEN 'Sub Division Engineer'
        WHEN 3 THEN 'Divisional Engineer'
        WHEN 4 THEN 'Executive Engineer'
        ELSE 'higher level engineer'
      END;
  END IF;

  -- Upsert workflow
  INSERT INTO estimate.approval_workflows (...)
  VALUES (...)
  ON CONFLICT (work_id) DO UPDATE ...
  RETURNING id INTO v_workflow_id;

  -- Add history entry
  INSERT INTO estimate.approval_history (...)
  VALUES (...);

  -- Update work status
  UPDATE estimate.works
  SET estimate_status = 'in_approval',
      status = 'pending'
  WHERE works_id = p_work_id;

  RETURN v_workflow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Missing:**
- ❌ NO `work_type` parameter
- ❌ NO conditional logic for TS vs TA
- ❌ NO TS-specific approver hierarchy
- ❌ Same role hierarchy for both work types

### 3.2 get_next_approver Function
**File:** `supabase/migrations/20251220184041_add_estimate_approval_workflow_system.sql` (line 246)

```sql
CREATE OR REPLACE FUNCTION estimate.get_next_approver(
  p_work_id text,
  p_current_level integer  -- ← Only work_id and level, NO work_type
)
RETURNS TABLE(user_id uuid, role_id integer, level integer) AS $$
DECLARE
  v_next_level integer;
  v_role_id integer;
BEGIN
  -- Calculate next level (1=JE, 2=Sub Div, 3=Div, 4=Exec)
  v_next_level := p_current_level + 1;
  
  -- If we've exceeded max level, return null
  IF v_next_level > 4 THEN
    RETURN;
  END IF;
  
  -- Map level to role ID (SAME FOR ALL WORK TYPES)
  v_role_id := CASE v_next_level
    WHEN 1 THEN 10  -- Junior Engineer
    WHEN 2 THEN 15  -- Sub Division Engineer
    WHEN 3 THEN 16  -- Divisional Engineer
    WHEN 4 THEN 17  -- Executive Engineer
  END;
  
  -- Find user assigned to this work with the required role
  RETURN QUERY
  SELECT 
    wa.user_id,
    wa.role_id,
    v_next_level
  FROM estimate.work_assignments wa
  WHERE wa.work_id = p_work_id
    AND wa.role_id = v_role_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Missing:**
- ❌ NO `work_type` parameter
- ❌ NO TS-specific role hierarchy
- ❌ Same static level-to-role mapping for both TS and TA

### 3.3 Role Hierarchy (Identical for TS and TA)
**From migrations:**

```
Level 1: Role ID 10 - Junior Engineer (JE)
Level 2: Role ID 15 - Sub Division Engineer
Level 3: Role ID 16 - Divisional Engineer
Level 4: Role ID 17 - Executive Engineer
```

All works (TS or TA) follow this same hierarchy regardless of type.

### 3.4 process_approval_action Function
**File:** `supabase/migrations/20251220192314_update_approval_actions_with_final_approve.sql` (line 21)

```sql
CREATE OR REPLACE FUNCTION estimate.process_approval_action(
  p_workflow_id uuid,
  p_action text,  -- 'approved', 'approved_final', 'rejected', 'sent_back'
  p_comments text DEFAULT NULL  -- ← NO work_type parameter
)
RETURNS boolean AS $$
DECLARE
  v_workflow record;
  v_next_approver record;
  v_approver_role integer;
  v_user_role text;
  v_is_admin boolean;
BEGIN
  -- ... verification logic ...
  
  -- Handle different actions (SAME FOR ALL WORK TYPES)
  IF p_action = 'approved' THEN
    -- Approve and forward to next level
    SELECT * INTO v_next_approver
    FROM estimate.get_next_approver(v_workflow.work_id, v_workflow.current_level);
    
    IF v_next_approver.user_id IS NULL THEN
      RAISE EXCEPTION 'No approver found for next level';
    END IF;
    -- ... update workflow ...
    
  ELSIF p_action = 'approved_final' THEN
    -- Final approval
    IF NOT v_is_admin AND v_workflow.current_level != 4 THEN
      RAISE EXCEPTION 'Only Executive Engineers (level 4) or admins can do final approval';
    END IF;
    -- ... update workflow ...
    
  ELSIF p_action = 'rejected' THEN
    -- ... handle rejection ...
    
  ELSIF p_action = 'sent_back' THEN
    -- ... handle sent back ...
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Missing:**
- ❌ NO `work_type` parameter
- ❌ NO TS-specific action handling
- ❌ NO conditional logic based on work type

---

## 4. REACT COMPONENTS - TS WORK HANDLING

### 4.1 EstimateApprovalActions.tsx
**File:** `src/components/EstimateApprovalActions.tsx` (line 67)

```typescript
const handleSubmitForApproval = async () => {
  if (!confirm('Submit this estimate for approval? Once submitted, the assigned approver will review it.')) return;
  try {
    setSubmitting(true);
    // ← Calls initiate_approval_workflow with only workId, NO work_type
    const { error } = await supabase.schema('estimate').rpc('initiate_approval_workflow', { 
      p_work_id: workId  // NO work_type parameter passed
    });
    if (error) throw error;
    onStatusUpdate();
    checkWorkflow();
  } catch (error: any) {
    let msg = error.message || error.hint || JSON.stringify(error);
    alert('Failed to submit for approval: ' + msg);
  } finally {
    setSubmitting(false);
  }
};
```

**Key Point:** No work type checking before submission - identical flow for TS and TA

### 4.2 WorkflowDashboard.tsx - TS/TA Separation
**File:** `src/components/WorkflowDashboard.tsx`

```typescript
// Line 250
const tsWorks = works.filter(w => w.type === 'Technical Sanction');
const taWorks = works.filter(w => w.type === 'Technical Approval');

// Line 321
{ key: 'ts' as const, label: 'Technical Sanction (TS)', list: tsWorks }

// Line 428-429
<span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
  work.type === 'Technical Approval' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-violet-50 text-violet-700 border-violet-200'
}`}>
  {work.type === 'Technical Approval' ? 'TA' : 'TS'}
</span>
```

**Key Point:** UI separates TS/TA for display, but workflow is identical

### 4.3 Works.tsx - TS Work Management
**File:** `src/components/Works.tsx`

```typescript
// Line 530-531
{work.estimate_status === 'approved' && work.type === 'Technical Sanction' ? (
  // Show MB promotion button only for approved TS works
)}

// Line 582-584
{activeTab === 'ta' && work.estimate_status === 'approved' && work.type === 'Technical Approval' && (
  onClick={() => handlePromoteToTS(work)}
  // Show promote to TS button only for TA tab
)}

// Line 692-699
placeholder={newWork.type === 'TS' ? 'Enter Technical Sanction No.' : 'Enter Technical Approval No.'}
```

**Key Point:** Conditional UI for TS-specific actions and field labels

### 4.4 WorkManagement.tsx (MB Projects)
**File:** `src/components/mb/WorkManagement.tsx`

```typescript
// Line 177 - Fetch projects with work_type
.select('id, project_code, project_name, works_id, status, work_type, technical_sanction_no, technical_approval_no')

// Line 194 - Filter by work_type
const matchesType = workTypeFilter === 'ALL' ||
  (project as any).work_type === workTypeFilter;

// Line 317 - Default to TA
work_type: (project as any).work_type || 'TA',

// Line 426-427 - Conditional field setting
technical_sanction_no: workDetails.work_type === 'TS' ? workDetails.technical_sanction_no : null,
technical_approval_no: workDetails.work_type === 'TA' ? workDetails.technical_approval_no : null,

// Line 807 - Badge styling
(project as any).work_type === 'TS' ? 'bg-purple-100 text-purple-800' : 'bg-teal-100 text-teal-800'
```

**Key Point:** Work type differentiation at data layer, not approval layer

---

## 5. ERROR MESSAGES & VALIDATION

### 5.1 No Approver Found Errors
**All migrations with identical error handling:**

```sql
RAISE EXCEPTION 'No approver found for the next level. Please ensure a % is assigned to this work.',
  CASE v_current_level + 1
    WHEN 2 THEN 'Sub Division Engineer'
    WHEN 3 THEN 'Divisional Engineer'
    WHEN 4 THEN 'Executive Engineer'
    ELSE 'higher level engineer'
  END;
```

**Locations:**
- `20251220184041_add_estimate_approval_workflow_system.sql` (line 312, 422)
- `20251220185157_update_initiate_approval_workflow_with_better_errors.sql` (line 45)
- `20260112035758_sync_status_with_approval_workflow.sql` (line 52)
- `20260428202322_fix_initiate_workflow_on_resubmit.sql` (line 64)

**⚠️ No TS-specific error messages**

### 5.2 Workflow State Errors
```sql
RAISE EXCEPTION 'This work already has an active approval workflow in progress.';
RAISE EXCEPTION 'This work has already been fully approved.';
RAISE EXCEPTION 'You are not assigned to this work. Please contact an administrator...';
RAISE EXCEPTION 'Only Executive Engineers (level 4) or admins can do final approval';
```

**⚠️ No TS-specific validation**

---

## 6. WORK ASSIGNMENTS TABLE

**File:** `supabase/migrations/20251220133602_add_work_assignments_and_engineer_roles.sql`

```sql
CREATE TABLE IF NOT EXISTS estimate.work_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id text NOT NULL REFERENCES estimate.works(works_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id integer REFERENCES public.roles(id) ON DELETE SET NULL,  -- ← Used in approval logic
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(work_id, user_id)
);
```

**Role IDs:**
- 10: Junior Engineer (JE)
- 15: Sub Division Engineer
- 16: Divisional Engineer
- 17: Executive Engineer

**⚠️ No work_type consideration in role assignment**

---

## 7. SUMMARY TABLE: TS vs TA HANDLING

| Feature | TS Handling | TA Handling | Difference |
|---------|-------------|-------------|-----------|
| **Data Fields** | work_type = 'TS', technical_sanction_no | work_type = 'TA', technical_approval_no | ✅ Different |
| **UI Display** | Separate tab, different badge colors | Separate tab, different colors | ✅ Different |
| **Promotion Flow** | Delete approval workflow, reset to draft | Can promote to TS | ✅ Different |
| **Approval Hierarchy** | Level 1→2→3→4 (JE→SubDiv→Div→Exec) | Level 1→2→3→4 (JE→SubDiv→Div→Exec) | ❌ **IDENTICAL** |
| **initiate_approval_workflow** | Called with work_id only | Called with work_id only | ❌ **IDENTICAL** |
| **get_next_approver** | Same role hierarchy lookup | Same role hierarchy lookup | ❌ **IDENTICAL** |
| **process_approval_action** | Same 4 actions (approved, rejected, sent_back, approved_final) | Same 4 actions | ❌ **IDENTICAL** |
| **Error Messages** | Generic "No approver found" | Generic "No approver found" | ❌ **IDENTICAL** |
| **Admin Override** | Yes (level 4 or admin) | Yes (level 4 or admin) | ❌ **IDENTICAL** |

---

## 8. IMPLICATIONS

### ✅ What IS Implemented:
1. TS/TA work type distinction at data model level
2. UI separation for TS and TA works
3. Conditional field display (technical_sanction_no vs technical_approval_no)
4. TA→TS promotion workflow with approval reset
5. Work assignments with role hierarchy (JE→SubDiv→Div→Exec)

### ❌ What IS NOT Implemented:
1. **Different approval hierarchies for TS vs TA**
2. **Work type parameter in approval RPC functions**
3. **Conditional logic in SQL functions based on work_type**
4. **TS-specific validation or error handling**
5. **TS-specific approver role requirements**

### 🔴 CRITICAL ISSUE:
**If the requirement is that TS works should have a DIFFERENT approval hierarchy than TA works, this functionality is NOT currently implemented.**

Both work types follow the same 4-level hierarchy:
1. Junior Engineer (Role 10)
2. Sub Division Engineer (Role 15)
3. Divisional Engineer (Role 16)
4. Executive Engineer (Role 17)

---

## 9. RECOMMENDATIONS

To implement TS-specific approval handling, you would need to:

1. **Modify SQL functions to accept work_type parameter:**
   ```sql
   CREATE OR REPLACE FUNCTION estimate.initiate_approval_workflow(
     p_work_id text,
     p_work_type text  -- NEW: 'TS' or 'TA'
   )
   ```

2. **Add conditional role hierarchy logic:**
   ```sql
   v_current_level := CASE 
     WHEN p_work_type = 'TS' THEN
       -- TS-specific hierarchy
     WHEN p_work_type = 'TA' THEN
       -- TA-specific hierarchy
     END;
   ```

3. **Update calling code to pass work_type:**
   ```typescript
   const { error } = await supabase.schema('estimate').rpc('initiate_approval_workflow', {
     p_work_id: workId,
     p_work_type: workType  // NEW: pass the work type
   });
   ```

4. **Add TS-specific validation or business rules as needed**

---

## 10. FILES INVOLVED

| File | Type | Usage |
|------|------|-------|
| `supabase/migrations/20260119064311_add_work_type_to_mb_projects.sql` | SQL | Work type field in mb_projects |
| `supabase/migrations/20251220133602_add_work_assignments_and_engineer_roles.sql` | SQL | Role hierarchy definition |
| `supabase/migrations/20251220184041_add_estimate_approval_workflow_system.sql` | SQL | get_next_approver() and initiate_approval_workflow() |
| `supabase/migrations/20251220192314_update_approval_actions_with_final_approve.sql` | SQL | process_approval_action() |
| `supabase/migrations/20260428202322_fix_initiate_workflow_on_resubmit.sql` | SQL | Current initiate_approval_workflow() |
| `src/components/Works.tsx` | React | handlePromoteToTS(), type filtering |
| `src/components/WorkflowDashboard.tsx` | React | TS/TA tab separation |
| `src/components/EstimateApprovalActions.tsx` | React | Approval submission |
| `src/components/mb/WorkManagement.tsx` | React | MB projects TS/TA management |

