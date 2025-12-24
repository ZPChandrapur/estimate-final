# Role-Based Access Control (RBAC) Documentation

## Table of Contents
1. [Overview](#overview)
2. [System Roles](#system-roles)
3. [Estimate Module - Access Control](#estimate-module---access-control)
4. [Measurement Book (MB) Module - Access Control](#measurement-book-mb-module---access-control)
5. [How Access Control Works](#how-access-control-works)
6. [How to Assign Roles](#how-to-assign-roles)
7. [RLS Policy Implementation](#rls-policy-implementation)

---

## Overview

This system uses **Row Level Security (RLS)** in Supabase PostgreSQL to implement fine-grained access control. Access is determined by:

1. **User Roles**: Assigned to users in the `public.user_roles` table
2. **Work Assignments**: Engineers assigned to specific works via `estimate.work_assignments`
3. **Project Assignments**: Users assigned to MB projects via `estimate.mb_project_assignments`
4. **Ownership**: Users who created records

### Key Principles

- **All tables have RLS enabled** - No data is accessible by default
- **Explicit policies grant access** - Each operation (SELECT, INSERT, UPDATE, DELETE) requires a policy
- **Role hierarchy respected** - admin → super_admin → developer have escalating permissions
- **Assignment-based access** - Engineers only see works/projects they're assigned to
- **Owner access** - Users always have access to records they created

---

## System Roles

### Global Roles

| Role ID | Role Name | Description | Application |
|---------|-----------|-------------|-------------|
| 1 | developer | Full system access for development and maintenance | All systems |
| 2 | super_admin | Complete administrative access to all systems | All systems |
| 3 | admin | Administrative access with some restrictions | All systems |

### Estimate Module Roles

| Role ID | Role Name | Description | Responsibilities |
|---------|-----------|-------------|------------------|
| 10 | Junior Engineer (JE) | Basic engineering role | Create and manage works, subworks, items |
| 15 | Sub Division Engineer | Mid-level engineer | Review and approve estimates at subdivision level |
| 16 | Divisional Engineer | Division-level oversight | Approve estimates at division level |
| 17 | Executive Engineer | Senior oversight role | Final approval and oversight of estimates |

### Measurement Book (MB) Module Roles

| Role ID | Role Name | Description | Responsibilities |
|---------|-----------|-------------|------------------|
| 18 | mb_clerk | MB Clerk | Upload BOQ, setup projects, manage project data |
| 19 | Contractor | Contractor | Enter measurements, submit for approval |
| 20 | Junior Engineer | Junior Engineer | Review contractor measurements, first-level approval |
| 21 | Deputy Engineer | Deputy Engineer | Verify JE approvals, second-level review |
| 22 | Auditor | Auditor | View audit logs and reports (read-only) |
| 23 | Accountant | Accountant | Access financial reports and bill data |
| 24 | Junior Engineer - District | District JE | District-level measurements and approvals |
| 25 | D-Executive Engineer | District Executive Engineer | District-level oversight |

---

## Estimate Module - Access Control

### Stage 1: Work Creation

**Table**: `estimate.works`

#### Access Rules:

| Role | Can Create | Can View | Can Update | Can Delete | Notes |
|------|------------|----------|------------|------------|-------|
| admin, super_admin, developer | ✅ | All works | All works | All works | Full access |
| Junior Engineer | ✅ | Assigned + Own | Own only | Own only | Must be assigned to work |
| Sub Division Engineer | ✅ | Assigned + Own | Assigned + Own | Own only | Must be assigned to work |
| Divisional Engineer | ✅ | Assigned + Own | Assigned + Own | Own only | Must be assigned to work |
| Executive Engineer | ✅ | Assigned + Own | Assigned + Own | Own only | Must be assigned to work |

#### RLS Policy Logic:

```sql
-- SELECT Policy: "Users can view assigned works"
SELECT allowed IF:
  - User has role: admin, super_admin, OR developer
  OR
  - User is assigned to this work (exists in work_assignments)
  OR
  - User created this work (created_by = auth.uid())

-- INSERT Policy: "Users can insert works"
INSERT allowed for all authenticated users

-- UPDATE Policy: "Users can update their own works"
UPDATE allowed IF:
  - created_by = auth.uid()

-- DELETE Policy: "Users can delete their own works"
DELETE allowed IF:
  - created_by = auth.uid()
```

#### Work Assignment Process:

1. Admin/Super Admin creates work assignment in `estimate.work_assignments`
2. Assignment links: `work_id` + `user_id` + `role_id`
3. Assigned user can now view and work on the assigned work
4. Multiple users can be assigned to same work with different roles

**Code Example - Creating Work Assignment:**

```typescript
// Admin assigns Junior Engineer to a work
const { data, error } = await supabase
  .schema('estimate')
  .from('work_assignments')
  .insert({
    work_id: '2025-TS-123',
    user_id: 'engineer-uuid',
    role_id: 10, // Junior Engineer role
    assigned_by: adminUserId
  });
```

---

### Stage 2: Subwork Creation

**Table**: `estimate.subworks`

#### Access Rules:

| Role | Can Create | Can View | Can Update | Can Delete | Notes |
|------|------------|----------|------------|------------|-------|
| All authenticated users | ✅ | All subworks | All subworks | All subworks | Open access within authenticated users |

#### RLS Policy Logic:

```sql
-- All operations allowed for authenticated users
SELECT/INSERT/UPDATE/DELETE allowed IF:
  - User is authenticated (auth.uid() IS NOT NULL)
```

**Why Open Access?**
- Subworks are children of works
- Access control enforced at work level
- If user can access work, they can manage its subworks
- Simplifies collaboration between engineers

---

### Stage 3: Subwork Items (Bill of Quantities)

**Table**: `estimate.subwork_items`

#### Access Rules:

| Role | Can Create | Can View | Can Update | Can Delete | Notes |
|------|------------|----------|------------|------------|-------|
| admin, super_admin, developer | ✅ | All items | All items | All items | Full access |
| Assigned Engineers | ✅ | All items | Own + Assigned | Own + Assigned | Can view all, modify assigned |
| Item Creator | ✅ | All items | Own items | Own items | Full access to own items |

#### RLS Policy Logic:

```sql
-- SELECT Policy: "Authenticated users can view all subwork items"
SELECT allowed IF:
  - User is authenticated

-- INSERT Policy: "Users can create subwork items"
INSERT allowed IF:
  - User has role: admin, super_admin, OR developer
  OR
  - User is assigned to the parent work
  OR
  - User created the parent work

-- UPDATE Policy: "Users can update subwork items"
UPDATE allowed IF:
  - User has role: admin, super_admin, OR developer
  OR
  - User created this item (created_by = auth.uid())
  OR
  - User is assigned to the parent work
  OR
  - User created the parent work

-- DELETE Policy: "Users can delete subwork items"
DELETE allowed IF:
  - User has role: admin, super_admin, OR developer
  OR
  - User created this item
  OR
  - User is assigned to the parent work
  OR
  - User created the parent work
```

---

### Stage 4: Item Rate Analysis

**Table**: `estimate.item_rate_analysis`

#### Access Rules:

| Role | Can Create | Can View | Can Update | Can Delete | Notes |
|------|------------|----------|------------|------------|-------|
| All authenticated users | ✅ | All analyses | Own only | Own only | Rate analysis for cost breakdown |

#### RLS Policy Logic:

```sql
-- SELECT Policy: "Authenticated users can read rate analyses"
SELECT allowed IF:
  - User is authenticated

-- INSERT Policy: "Authenticated users can insert rate analyses"
INSERT allowed IF:
  - User is authenticated

-- UPDATE Policy: "Authenticated users can update own rate analyses"
UPDATE allowed IF:
  - created_by = auth.uid()

-- DELETE Policy: "Authenticated users can delete own rate analyses"
DELETE allowed IF:
  - created_by = auth.uid()
```

**Purpose**: Rate analysis breaks down item rates into:
- Materials
- Labour
- Lead charges (transportation)
- Equipment
- Taxes

---

### Stage 5: Lead Statements

**Table**: `estimate.lead_statements`

#### Access Rules:

| Role | Can Create | Can View | Can Update | Can Delete | Notes |
|------|------------|----------|------------|------------|-------|
| All authenticated users | ✅ | All statements | Assigned works | Assigned works | Lead charges for materials |

#### RLS Policy Logic:

```sql
-- SELECT Policy: "Authenticated users can view all lead statements"
SELECT allowed IF:
  - User is authenticated

-- INSERT Policy: "Users can insert lead statements for their assigned works"
INSERT allowed IF:
  - User is authenticated

-- UPDATE Policy: "Users can update lead statements for their assigned works"
UPDATE allowed IF:
  - User is assigned to the work OR user is admin/super_admin/developer

-- DELETE Policy: "Users can delete lead statements for their assigned works"
DELETE allowed IF:
  - User is assigned to the work OR user is admin/super_admin/developer
```

---

### Stage 6: Estimate Approval Workflow

**Tables**:
- `estimate.approval_workflows` - Workflow state
- `estimate.approval_history` - Approval actions log

#### Approval Hierarchy:

1. **Initiator** (Junior Engineer) → Creates estimate
2. **Level 1** (Sub Division Engineer) → First approval
3. **Level 2** (Divisional Engineer) → Second approval
4. **Level 3** (Executive Engineer) → Final approval

#### Access Rules:

| Role | Can Initiate | Can Approve Level 1 | Can Approve Level 2 | Can Approve Level 3 |
|------|--------------|---------------------|---------------------|---------------------|
| Junior Engineer | ✅ | ❌ | ❌ | ❌ |
| Sub Division Engineer | ✅ | ✅ | ❌ | ❌ |
| Divisional Engineer | ✅ | ✅ | ✅ | ❌ |
| Executive Engineer | ✅ | ✅ | ✅ | ✅ |
| admin/super_admin/developer | ✅ | ✅ | ✅ | ✅ |

#### RLS Policy Logic:

```sql
-- approval_workflows SELECT Policy
SELECT allowed IF:
  - User is admin/super_admin/developer
  OR
  - User created the work (work creator)
  OR
  - User is assigned to the work
  OR
  - User is the current approver

-- approval_workflows INSERT Policy
INSERT allowed IF:
  - User created the work OR user is assigned to work

-- approval_workflows UPDATE Policy (Approval Action)
UPDATE allowed IF:
  - User is the current level approver (current_approver_id = auth.uid())
  OR
  - User is admin/super_admin/developer
```

**Code Example - Initiating Approval:**

```typescript
// Junior Engineer initiates approval workflow
const { data, error } = await supabase
  .rpc('initiate_approval_workflow', {
    p_work_id: '2025-TS-123',
    p_work_type: 'Technical Sanction'
  });

// Returns workflow with:
// - workflow_id
// - current_level: 1
// - current_approver_id: (Sub Division Engineer UUID)
// - status: 'pending_level_1'
```

**Code Example - Processing Approval:**

```typescript
// Sub Division Engineer approves
const { data, error } = await supabase
  .rpc('process_approval_action', {
    p_workflow_id: workflowId,
    p_action: 'approved', // or 'rejected' or 'returned_for_correction'
    p_comments: 'Approved after review'
  });

// Automatically:
// - Updates workflow to next level
// - Assigns next approver
// - Logs action in approval_history
// - Sends notifications
```

---

### Stage 7: BOQ Generation

**Table**: `estimate.boq`

#### Access Rules:

| Role | Can Create | Can View | Can Update | Can Delete | Notes |
|------|------------|----------|------------|------------|-------|
| admin, super_admin, developer | ✅ | All BOQ | All BOQ | All BOQ | Full access |
| Assigned Engineers | ✅ | Assigned works | Assigned works | ❌ | Based on work assignment |

#### RLS Policy Logic:

```sql
-- SELECT Policy: "Users can view BOQ for assigned works"
SELECT allowed IF:
  - User is admin/super_admin/developer
  OR
  - User is assigned to the work
  OR
  - User created the work

-- INSERT/UPDATE Policies: Same as SELECT
-- DELETE Policy: Only admin/super_admin/developer
```

**Purpose**: BOQ (Bill of Quantities) is generated from approved estimates for tendering and execution.

---

## Measurement Book (MB) Module - Access Control

### Stage 1: MB Project Setup

**Table**: `estimate.mb_projects`

#### Access Rules:

| Role | Can Create | Can View | Can Update | Can Delete | Notes |
|------|------------|----------|------------|------------|-------|
| admin, super_admin, developer | ✅ | All projects | All projects | All projects | Full access |
| mb_clerk | ✅ | All projects | All projects | ❌ | Setup and manage projects |
| Executive Engineer | ✅ | All projects | All projects | ❌ | Oversight |
| Other roles | ❌ | Assigned only | ❌ | ❌ | View assigned projects only |

#### RLS Policy Logic:

```sql
-- SELECT Policy: "Users can view mb_projects"
SELECT allowed IF:
  - User is authenticated

-- INSERT Policy: "Authorized users can insert projects"
INSERT allowed IF:
  - User has role: admin, super_admin, developer, mb_clerk, Executive Engineer

-- UPDATE Policy: "Authorized users can update projects"
UPDATE allowed IF:
  - User has role: admin, super_admin, developer, mb_clerk, Executive Engineer
```

#### MB Project Assignment Process:

```typescript
// MB Clerk assigns project roles
const { data, error } = await supabase
  .schema('estimate')
  .from('mb_project_assignments')
  .insert([
    {
      project_id: projectId,
      user_id: contractorUserId,
      role_type: 'contractor',
      assigned_by: mbClerkUserId
    },
    {
      project_id: projectId,
      user_id: jeUserId,
      role_type: 'je',
      assigned_by: mbClerkUserId
    },
    {
      project_id: projectId,
      user_id: deputyEngUserId,
      role_type: 'deputy_engineer',
      assigned_by: mbClerkUserId
    }
  ]);
```

---

### Stage 2: BOQ Upload

**Table**: `estimate.mb_boq_items`

#### Access Rules:

| Role | Can Upload | Can View | Can Update | Can Delete | Notes |
|------|------------|----------|------------|------------|-------|
| admin, super_admin, developer | ✅ | All BOQ | ✅ | ✅ | Full access |
| mb_clerk | ✅ | All BOQ | ✅ | ❌ | Upload and manage BOQ |
| Executive Engineer | ✅ | All BOQ | ✅ | ❌ | Can modify BOQ |
| Contractor, JE, Deputy Engineer | ❌ | Assigned projects | ❌ | ❌ | Read-only access |

#### RLS Policy Logic:

```sql
-- SELECT Policy: "Users can view boq items"
SELECT allowed IF:
  - User is authenticated

-- INSERT/UPDATE/DELETE Policies: "Authorized users can manage boq items"
Operation allowed IF:
  - User has role: admin, super_admin, developer, mb_clerk, Executive Engineer
```

---

### Stage 3: Measurement Entry

**Table**: `estimate.mb_measurements`

#### Measurement Status Flow:
```
draft → submitted → je_approved → deputy_approved → finalized
```

#### Access Rules:

| Role | Can Create | Can View | Can Update Status | Can Modify Draft | Notes |
|------|------------|----------|-------------------|------------------|-------|
| Contractor | ✅ | Own measurements | Submit draft | Own draft only | Create and submit measurements |
| Junior Engineer | ❌ | All measurements | Approve/Reject | ❌ | First approval level |
| Deputy Engineer | ❌ | All measurements | Approve/Reject | ❌ | Second approval level |
| Executive Engineer | ❌ | All measurements | Finalize | ❌ | Final approval |
| Auditor | ❌ | All measurements | ❌ | ❌ | Read-only access |

#### RLS Policy Logic:

```sql
-- SELECT Policy: "Users can view measurements"
SELECT allowed IF:
  - User is authenticated

-- INSERT Policy: "Contractors can insert measurements"
INSERT allowed IF:
  - User is assigned to project as contractor

-- UPDATE Policy 1: "Contractors can update draft measurements"
UPDATE allowed IF:
  - measurement status = 'draft'
  AND created_by = auth.uid()
  AND user is contractor on the project

-- UPDATE Policy 2: "Engineers can update measurement status"
UPDATE allowed IF:
  - User has role: Junior Engineer, Deputy Engineer, Executive Engineer, admin, super_admin, developer
  AND user is assigned to the project
```

**Code Example - Contractor Creates Measurement:**

```typescript
// Contractor creates measurement entry
const { data, error } = await supabase
  .schema('estimate')
  .from('mb_measurements')
  .insert({
    boq_item_id: boqItemId,
    project_id: projectId,
    measurement_date: new Date(),
    number: 10.5,
    length: 5.0,
    breadth: 3.0,
    height: 2.0,
    quantity: 315.0, // Auto-calculated: 10.5 * 5 * 3 * 2
    remarks: 'RCC work at location A',
    status: 'draft',
    created_by: contractorUserId
  });

// Contractor submits for approval
const { data: updateData, error: updateError } = await supabase
  .schema('estimate')
  .from('mb_measurements')
  .update({ status: 'submitted' })
  .eq('id', measurementId);
```

**Code Example - JE Approves Measurement:**

```typescript
// Junior Engineer approves
const { data, error } = await supabase
  .schema('estimate')
  .from('mb_approvals')
  .insert({
    measurement_id: measurementId,
    approved_by: jeUserId,
    approval_level: 'je',
    status: 'approved',
    remarks: 'Verified on site',
    approved_at: new Date()
  });

// Update measurement status
await supabase
  .schema('estimate')
  .from('mb_measurements')
  .update({ status: 'je_approved' })
  .eq('id', measurementId);
```

---

### Stage 4: Bill Generation

**Tables**:
- `estimate.mb_bills` - Bill header
- `estimate.mb_bill_items` - Bill line items

#### Access Rules:

| Role | Can Create | Can View | Can Update | Can Delete | Notes |
|------|------------|----------|------------|------------|-------|
| admin, super_admin, developer | ✅ | All bills | ✅ | ✅ | Full access |
| mb_clerk | ✅ | All bills | ✅ | ❌ | Generate and manage bills |
| Executive Engineer | ✅ | All bills | ✅ | ❌ | Can modify bills |
| Junior Engineer, Deputy Engineer | ❌ | Assigned projects | ❌ | ❌ | Read-only |
| Accountant | ❌ | All bills | ❌ | ❌ | Financial reports |

#### RLS Policy Logic:

```sql
-- SELECT Policy: "Users can view bills"
SELECT allowed IF:
  - User is authenticated

-- INSERT Policy: "Authorized users can create bills"
INSERT allowed IF:
  - User has role: admin, super_admin, developer, mb_clerk, Executive Engineer

-- UPDATE Policy: "Authorized users can update bills"
UPDATE allowed IF:
  - User has role: admin, super_admin, developer, mb_clerk, Executive Engineer
```

**Code Example - Generate Bill:**

```typescript
// MB Clerk creates new bill
const { data: bill, error: billError } = await supabase
  .schema('estimate')
  .from('mb_bills')
  .insert({
    project_id: projectId,
    bill_no: 'BILL-001',
    bill_type: 'running', // or 'final'
    bill_date: new Date(),
    from_date: '2025-01-01',
    to_date: '2025-01-31',
    status: 'draft',
    created_by: mbClerkUserId
  })
  .select()
  .single();

// Add approved measurements to bill
const { data: billItems, error: itemsError } = await supabase
  .schema('estimate')
  .from('mb_bill_items')
  .insert(
    approvedMeasurements.map(m => ({
      bill_id: bill.id,
      measurement_id: m.id,
      boq_item_id: m.boq_item_id,
      quantity: m.quantity,
      rate: m.boq_rate,
      amount: m.quantity * m.boq_rate
    }))
  );
```

---

### Stage 5: Bill Approval Workflow

**Tables**:
- `estimate.mb_bill_approvals` - Approval records
- `estimate.mb_bill_approval_history` - Approval history

#### Bill Approval Hierarchy:
```
1. Junior Engineer → Reviews bill items
2. Deputy Engineer → Verifies calculations
3. Executive Engineer → Final approval
4. Accountant → Processes payment
```

#### Access Rules:

| Role | Level 1 (JE) | Level 2 (Deputy) | Level 3 (EE) | View History | Notes |
|------|--------------|------------------|--------------|--------------|-------|
| Junior Engineer | ✅ | ❌ | ❌ | ✅ | First approval |
| Deputy Engineer | ❌ | ✅ | ❌ | ✅ | Second approval |
| Executive Engineer | ❌ | ❌ | ✅ | ✅ | Final approval |
| Accountant | ❌ | ❌ | ❌ | ✅ | View only |
| admin/super_admin | ✅ | ✅ | ✅ | ✅ | All levels |

#### RLS Policy Logic:

```sql
-- SELECT Policy: "Users can view bill approvals"
SELECT allowed IF:
  - User is authenticated

-- INSERT/UPDATE Policy: "Authorized users can manage bill approvals"
Operation allowed IF:
  - User has role: admin, super_admin, developer, Junior Engineer, Deputy Engineer, Executive Engineer
  AND user is assigned to the project
```

---

### Stage 6: Bill Checks

**Tables**:
- `estimate.mb_bill_check_types` - Check categories
- `estimate.mb_bill_check_values` - Check values per bill

#### Check Categories:
1. Work done as per specification
2. Measurements verified on site
3. Rates as per approved BOQ
4. Deductions applied correctly
5. Previous bills reconciled
6. Security deposit deducted

#### Access Rules:

| Role | Can Configure Checks | Can Complete Checks | Can View Checks | Notes |
|------|----------------------|---------------------|-----------------|-------|
| admin, super_admin, developer | ✅ | ✅ | ✅ | Full access |
| Executive Engineer | ✅ | ✅ | ✅ | Can configure and complete |
| Junior Engineer, Deputy Engineer | ❌ | ✅ | ✅ | Can complete checks |
| Accountant, Auditor | ❌ | ❌ | ✅ | Read-only |

#### RLS Policy Logic:

```sql
-- mb_bill_check_types
-- Only superadmins/developers can configure check types
SELECT allowed for authenticated users
INSERT/UPDATE/DELETE allowed for super_admin, developer

-- mb_bill_check_values
-- Assigned project users can complete checks
SELECT allowed for authenticated users
INSERT/UPDATE allowed for users assigned to project
```

---

### Stage 7: Reports and Audit

**Tables**:
- `estimate.mb_reports` - Generated reports
- `estimate.mb_audit_logs` - System audit trail

#### Access Rules:

| Role | Can Generate | Can View | Can Audit | Notes |
|------|--------------|----------|-----------|-------|
| admin, super_admin, developer | ✅ | All reports | ✅ | Full access |
| Executive Engineer | ✅ | All reports | ✅ | Can generate and audit |
| Accountant | ✅ | Financial reports | ❌ | Financial reports only |
| Auditor | ❌ | All reports | ✅ | Read-only audit access |
| mb_clerk | ✅ | All reports | ❌ | Can generate reports |
| Other roles | ❌ | Assigned projects | ❌ | Limited access |

#### RLS Policy Logic:

```sql
-- mb_reports
SELECT allowed for authenticated users
INSERT allowed for authorized roles (admin, super_admin, developer, Executive Engineer, Accountant, mb_clerk)

-- mb_audit_logs
SELECT allowed for authorized roles (admin, super_admin, developer, Executive Engineer, Auditor)
INSERT allowed for system (all authenticated users for logging)
```

---

## How Access Control Works

### 1. Authentication Check
```
User logs in → Supabase Auth → auth.uid() set in session
```

### 2. Role Resolution
```sql
-- System checks user roles
SELECT r.name
FROM public.user_roles ur
JOIN public.roles r ON ur.role_id = r.id
WHERE ur.user_id = auth.uid();
```

### 3. Assignment Check
```sql
-- For Estimate: Check work_assignments
SELECT 1
FROM estimate.work_assignments
WHERE work_id = 'WORK-123'
AND user_id = auth.uid();

-- For MB: Check mb_project_assignments
SELECT 1
FROM estimate.mb_project_assignments
WHERE project_id = 'PROJECT-UUID'
AND user_id = auth.uid();
```

### 4. RLS Policy Evaluation

When a query is executed:

```typescript
// User queries for works
const { data, error } = await supabase
  .schema('estimate')
  .from('works')
  .select('*');
```

Supabase automatically:
1. Checks if user is authenticated
2. Evaluates all SELECT policies for the table
3. Applies the USING clause conditions
4. Returns only rows where at least one policy evaluates to TRUE
5. If no policy allows access, returns empty result (not an error)

---

## How to Assign Roles

### Assigning System Roles

**Step 1: Identify User ID**
```sql
-- Get user ID from email
SELECT id, email FROM auth.users WHERE email = 'user@example.com';
```

**Step 2: Assign Role**
```typescript
const { data, error } = await supabase
  .from('user_roles')
  .insert({
    user_id: 'user-uuid',
    role_id: 10, // Junior Engineer
    assigned_by: 'admin-uuid'
  });
```

**Step 3: Verify Assignment**
```typescript
const { data, error } = await supabase
  .from('user_roles')
  .select(`
    *,
    roles (
      id,
      name,
      description
    )
  `)
  .eq('user_id', 'user-uuid');
```

---

### Assigning Work Access (Estimate Module)

**Code Example:**

```typescript
// Admin assigns engineer to work
async function assignEngineerToWork(
  workId: string,
  userId: string,
  roleId: number
) {
  const { data, error } = await supabase
    .schema('estimate')
    .from('work_assignments')
    .insert({
      work_id: workId,
      user_id: userId,
      role_id: roleId,
      assigned_by: adminUser.id
    });

  if (error) {
    console.error('Assignment failed:', error);
    return null;
  }

  console.log('Engineer assigned successfully:', data);
  return data;
}

// Usage
await assignEngineerToWork(
  '2025-TS-123',
  'engineer-uuid',
  10 // Junior Engineer
);
```

**UI Component for Assignment:**

```typescript
// React component
function WorkAssignmentForm({ workId }: { workId: string }) {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState(10);

  const handleAssign = async () => {
    const { error } = await supabase
      .schema('estimate')
      .from('work_assignments')
      .insert({
        work_id: workId,
        user_id: selectedUserId,
        role_id: selectedRoleId,
        assigned_by: currentUser.id
      });

    if (!error) {
      alert('Engineer assigned successfully');
    }
  };

  return (
    <form onSubmit={handleAssign}>
      <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
        {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
      </select>
      <select value={selectedRoleId} onChange={e => setSelectedRoleId(+e.target.value)}>
        <option value={10}>Junior Engineer</option>
        <option value={15}>Sub Division Engineer</option>
        <option value={16}>Divisional Engineer</option>
        <option value={17}>Executive Engineer</option>
      </select>
      <button type="submit">Assign</button>
    </form>
  );
}
```

---

### Assigning Project Access (MB Module)

**Code Example:**

```typescript
// MB Clerk assigns team to project
async function assignProjectTeam(
  projectId: string,
  assignments: Array<{
    userId: string;
    roleType: 'contractor' | 'je' | 'deputy_engineer' | 'executive_engineer' | 'auditor';
  }>
) {
  const { data, error } = await supabase
    .schema('estimate')
    .from('mb_project_assignments')
    .insert(
      assignments.map(a => ({
        project_id: projectId,
        user_id: a.userId,
        role_type: a.roleType,
        assigned_by: currentUser.id
      }))
    );

  if (error) {
    console.error('Team assignment failed:', error);
    return null;
  }

  console.log('Team assigned successfully:', data);
  return data;
}

// Usage
await assignProjectTeam('project-uuid', [
  { userId: 'contractor-uuid', roleType: 'contractor' },
  { userId: 'je-uuid', roleType: 'je' },
  { userId: 'deputy-uuid', roleType: 'deputy_engineer' },
  { userId: 'ee-uuid', roleType: 'executive_engineer' }
]);
```

---

## RLS Policy Implementation

### Policy Structure

Every RLS policy has:

1. **Name**: Descriptive name for the policy
2. **Command**: SELECT, INSERT, UPDATE, DELETE, or ALL
3. **Role**: Which database role (usually `authenticated`)
4. **USING**: Condition for row visibility (SELECT, UPDATE, DELETE)
5. **WITH CHECK**: Condition for new/modified rows (INSERT, UPDATE)

### Example Policy Breakdown

```sql
CREATE POLICY "Users can view assigned works"
  ON estimate.works
  FOR SELECT
  TO authenticated
  USING (
    -- This condition determines which rows are visible
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (
        SELECT id FROM public.roles
        WHERE name IN ('admin', 'super_admin', 'developer')
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM estimate.work_assignments
      WHERE work_assignments.work_id = works.works_id
      AND work_assignments.user_id = auth.uid()
    )
    OR
    created_by = auth.uid()
  );
```

**Breaking it down:**

1. **Policy name**: "Users can view assigned works"
2. **Table**: `estimate.works`
3. **Operation**: SELECT (read)
4. **User type**: authenticated (logged-in users)
5. **Condition logic**:
   - IF user is admin/super_admin/developer → SHOW ROW
   - OR IF user is assigned to this work → SHOW ROW
   - OR IF user created this work → SHOW ROW
   - ELSE → HIDE ROW

---

### Creating New RLS Policies

**Template for a new table:**

```sql
-- 1. Enable RLS
ALTER TABLE estimate.your_table ENABLE ROW LEVEL SECURITY;

-- 2. SELECT Policy (who can view)
CREATE POLICY "Users can view records"
  ON estimate.your_table
  FOR SELECT
  TO authenticated
  USING (
    -- Your visibility logic here
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_id IN (1, 2, 3) -- admin, super_admin, developer
    )
  );

-- 3. INSERT Policy (who can create)
CREATE POLICY "Users can create records"
  ON estimate.your_table
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Your creation logic here
    auth.uid() IS NOT NULL
  );

-- 4. UPDATE Policy (who can modify)
CREATE POLICY "Users can update own records"
  ON estimate.your_table
  FOR UPDATE
  TO authenticated
  USING (
    -- Which rows can be updated
    created_by = auth.uid()
  )
  WITH CHECK (
    -- What values can be set
    created_by = auth.uid()
  );

-- 5. DELETE Policy (who can delete)
CREATE POLICY "Users can delete own records"
  ON estimate.your_table
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
  );
```

---

### Testing RLS Policies

**Method 1: Using psql/SQL Editor**

```sql
-- Impersonate a user
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "user-uuid"}';

-- Test query
SELECT * FROM estimate.works;

-- Reset
RESET role;
```

**Method 2: Using Supabase Client**

```typescript
// Login as specific user
const { data: authData } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'password'
});

// Try to access data
const { data: works, error } = await supabase
  .schema('estimate')
  .from('works')
  .select('*');

console.log('Accessible works:', works?.length);

// Try to access unauthorized work
const { data: unauthorizedWork, error: accessError } = await supabase
  .schema('estimate')
  .from('works')
  .select('*')
  .eq('works_id', 'UNAUTHORIZED-WORK-ID')
  .single();

console.log('Access denied?', accessError); // Should be empty or not found
```

---

### Common RLS Patterns

#### Pattern 1: Owner-Only Access
```sql
USING (created_by = auth.uid())
```

#### Pattern 2: Admin Override
```sql
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role_id IN (SELECT id FROM public.roles WHERE name IN ('admin', 'super_admin', 'developer'))
  )
)
```

#### Pattern 3: Assignment-Based
```sql
USING (
  EXISTS (
    SELECT 1 FROM estimate.work_assignments
    WHERE work_assignments.work_id = table.work_id
    AND work_assignments.user_id = auth.uid()
  )
)
```

#### Pattern 4: Hierarchical (Parent-Child)
```sql
-- Access subwork if you can access parent work
USING (
  EXISTS (
    SELECT 1 FROM estimate.works w
    WHERE w.works_id = subworks.works_id
    AND (
      w.created_by = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM estimate.work_assignments wa
        WHERE wa.work_id = w.works_id
        AND wa.user_id = auth.uid()
      )
    )
  )
)
```

#### Pattern 5: Role-Based
```sql
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('Junior Engineer', 'Executive Engineer')
  )
)
```

---

## Security Best Practices

### 1. Always Enable RLS
```sql
-- Never forget this!
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

Without RLS enabled, policies have no effect and data may be publicly accessible.

### 2. Explicit is Better than Implicit

Bad (too permissive):
```sql
USING (true)  -- Everyone can access everything!
```

Good (explicit conditions):
```sql
USING (
  created_by = auth.uid()
  OR
  EXISTS (SELECT 1 FROM work_assignments WHERE ...)
)
```

### 3. Test with Multiple User Roles

Always test:
- As admin (should see everything)
- As regular user (should see only assigned/owned)
- As unauthorized user (should see nothing)

### 4. Use Indexes for Performance

```sql
-- Index foreign keys used in RLS policies
CREATE INDEX idx_work_assignments_user_id ON estimate.work_assignments(user_id);
CREATE INDEX idx_work_assignments_work_id ON estimate.work_assignments(work_id);
CREATE INDEX idx_subwork_items_created_by ON estimate.subwork_items(created_by);
```

### 5. Audit Regularly

```sql
-- Check which tables have RLS enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'estimate';

-- Check policies for a table
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'estimate'
AND tablename = 'works';
```

---

## Troubleshooting

### Problem: User cannot see data they should access

**Check 1: Is RLS enabled?**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'estimate' AND tablename = 'your_table';
```

**Check 2: Are there policies?**
```sql
SELECT * FROM pg_policies
WHERE schemaname = 'estimate' AND tablename = 'your_table';
```

**Check 3: Does user have correct role?**
```sql
SELECT * FROM public.user_roles WHERE user_id = 'user-uuid';
```

**Check 4: Is user assigned to work/project?**
```sql
SELECT * FROM estimate.work_assignments WHERE user_id = 'user-uuid';
-- OR
SELECT * FROM estimate.mb_project_assignments WHERE user_id = 'user-uuid';
```

---

### Problem: User can see data they shouldn't

**Check 1: Policy too permissive?**
```sql
-- Look for USING (true) or overly broad conditions
SELECT policyname, qual FROM pg_policies
WHERE schemaname = 'estimate' AND tablename = 'your_table';
```

**Check 2: Multiple conflicting policies?**
```sql
-- RLS uses OR logic - if ANY policy allows access, access is granted
SELECT COUNT(*) FROM pg_policies
WHERE schemaname = 'estimate'
AND tablename = 'your_table'
AND cmd = 'SELECT';
```

**Fix:** Drop overly permissive policies
```sql
DROP POLICY "policy_name" ON estimate.your_table;
```

---

## Summary

### Key Takeaways

1. **RLS is enforced at database level** - Cannot be bypassed by application code
2. **Roles + Assignments = Access** - Users need both system role AND work/project assignment
3. **Explicit policies required** - Each operation needs a policy or it's denied
4. **Test thoroughly** - Test with different user roles and scenarios
5. **Document policies** - Clear policy names and comments help maintenance

### Quick Reference

| Need | Use This |
|------|----------|
| Grant system role | Insert into `public.user_roles` |
| Assign to work | Insert into `estimate.work_assignments` |
| Assign to MB project | Insert into `estimate.mb_project_assignments` |
| Check user access | Query with user's auth token and check results |
| Add new table | Enable RLS + Create policies for SELECT/INSERT/UPDATE/DELETE |
| Debug access | Check RLS enabled → Check policies → Check roles → Check assignments |

---

## Appendix: Complete Table List

### Estimate Module Tables (with RLS)
- estimate.works
- estimate.subworks
- estimate.subwork_items
- estimate.item_rates
- estimate.item_rate_analysis
- estimate.item_measurements
- estimate.item_materials
- estimate.item_leads
- estimate.lead_statements
- estimate.work_assignments
- estimate.approval_workflows
- estimate.approval_history
- estimate.boq
- estimate.estimate_templates
- estimate.measurement_book
- estimate.subwork_design_photos

### MB Module Tables (with RLS)
- estimate.mb_projects
- estimate.mb_project_assignments
- estimate.mb_contractors
- estimate.mb_boq_items
- estimate.mb_measurements
- estimate.mb_approvals
- estimate.mb_bills
- estimate.mb_bill_items
- estimate.mb_bill_approvals
- estimate.mb_bill_approval_history
- estimate.mb_bill_check_types
- estimate.mb_bill_check_values
- estimate.mb_reports
- estimate.mb_audit_logs
- estimate.mb_notifications
- estimate.mb_project_subworks
- estimate.mb_work_role_assignments
- estimate.mb_work_subworks

### Reference Tables (Read-Only)
- estimate.SSR_2022_23
- estimate.CSR-2022-2023
- estimate.Lead_Charges_Materials_22-23

---

**Document Version**: 1.0
**Last Updated**: December 24, 2025
**Maintained By**: Development Team

For questions or clarifications, please contact the system administrator.
