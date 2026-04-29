# Approval Workflow System - Comprehensive Analysis

## 1. CURRENT APPROVAL WORKFLOW TABLE STRUCTURE

### `estimate.approval_workflows`
Manages the approval chain for each work/estimate.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | uuid | PRIMARY KEY | Unique workflow identifier |
| `work_id` | text | NOT NULL, REFERENCES works(works_id) ON DELETE CASCADE | Links to the work being approved |
| `current_level` | integer | DEFAULT 1, CHECK 1-4 | Current approval level in hierarchy |
| `current_approver_id` | uuid | REFERENCES auth.users(id) | User ID of current approver |
| `status` | text | DEFAULT 'pending_approval' | Workflow status (see Status States below) |
| `initiated_by` | uuid | REFERENCES auth.users(id) | User who started the approval |
| `initiated_at` | timestamptz | DEFAULT now() | Timestamp when approval started |
| `completed_at` | timestamptz | NULLABLE | When approval finished (approved/rejected) |
| `created_at` | timestamptz | DEFAULT now() | Record creation time |
| `updated_at` | timestamptz | DEFAULT now() | Last update time (trigger-managed) |
| **`work_type`** | **text** | **MISSING - ISSUE** | Should be 'TA' or 'TS' - **NOT CURRENTLY IN SCHEMA** |

**ISSUE IDENTIFIED**: The `work_type` column is referenced in the UI code but NOT present in the database schema. Frontend code tries to filter workflows by work_type but the table doesn't have this column.

### `estimate.approval_history`
Tracks all approval actions and comments.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | uuid | PRIMARY KEY | Unique history entry |
| `workflow_id` | uuid | REFERENCES approval_workflows(id) ON DELETE CASCADE | Links to workflow |
| `work_id` | text | NOT NULL, REFERENCES works(works_id) | Work reference |
| `level` | integer | CHECK 1-4 | Approval level when action taken |
| `approver_id` | uuid | NOT NULL, REFERENCES auth.users(id) | User who took action |
| `approver_role_id` | integer | REFERENCES public.roles(id) | Role of approver |
| `action` | text | CHECK values | Type of action taken |
| `comments` | text | NULLABLE | Optional comments/reasons |
| `previous_approver_id` | uuid | NULLABLE, REFERENCES auth.users(id) | For forwarded cases |
| `next_approver_id` | uuid | NULLABLE, REFERENCES auth.users(id) | Next approver in chain |
| `created_at` | timestamptz | DEFAULT now() | Action timestamp |

### `estimate.works` - Approval Status Column

| Column | Type | Purpose |
|--------|------|---------|
| `estimate_status` | text | Tracks preparation and approval state |

**Valid values**: `draft`, `ready_for_approval`, `in_approval`, `approved`, `rejected`, `sent_back`

---

## 2. APPROVAL HIERARCHY & LEVELS

### Role-Based Approval Levels

```
Level 1: Junior Engineer (JE)
         ↓ (submits to Level 2)
Level 2: Sub Division Engineer (SDE) - role_id: 15
         ↓ (submits to Level 3)
Level 3: Divisional Engineer (DE) - role_id: 16
         ↓ (submits to Level 4)
Level 4: Executive Engineer (EE) - role_id: 17
         ↓ (Final approval - work is approved)
```

### Role ID Mapping
- **10**: Junior Engineer (JE)
- **15**: Sub Division Engineer
- **16**: Divisional Engineer
- **17**: Executive Engineer

Users are assigned to works via `estimate.work_assignments` table:

```sql
CREATE TABLE estimate.work_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id text NOT NULL REFERENCES estimate.works(works_id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role_id integer NOT NULL REFERENCES public.roles(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(work_id, user_id, role_id)
);
```

---

## 3. APPROVAL STATES & TRANSITIONS

### Workflow Status States

```
┌─────────────────────────────────────────────────────────────┐
│                    APPROVAL WORKFLOW STATES                  │
└─────────────────────────────────────────────────────────────┘

1. DRAFT / READY_FOR_APPROVAL
   ├─ User marks work as "ready_for_approval" (estimate_status)
   └─ Shows "Mark as Ready" button in UI

2. PENDING_APPROVAL (Active Workflow)
   ├─ User submits for approval via initiate_approval_workflow()
   ├─ Workflow created with status = 'pending_approval'
   ├─ current_level set based on initiator's role
   ├─ current_approver_id set to next level engineer
   ├─ estimate_status = 'in_approval'
   └─ Shows "In Approval" status in UI

3. APPROVED (Final State)
   ├─ Triggered when current_level reaches 4 (Executive Engineer approves)
   ├─ status = 'approved'
   ├─ completed_at = now()
   ├─ estimate_status = 'approved'
   └─ Shows "Approved" badge in UI

4. REJECTED (Final State)
   ├─ Approver rejects at any level
   ├─ status = 'rejected'
   ├─ completed_at = now()
   ├─ estimate_status = 'rejected'
   └─ Shows "Rejected" badge in UI

5. SENT_BACK (Actionable State)
   ├─ Approver sends work back for modifications
   ├─ status = 'sent_back'
   ├─ completed_at = now()
   ├─ estimate_status = 'sent_back'
   └─ Shows "Re-submit for Approval" button in UI
```

### Approval History Actions

Tracked in `approval_history` table:

- **`submitted`**: User submitted work for approval
- **`approved`**: Approver approved (forwarded to next level)
- **`approved_final`**: Executive Engineer gave final approval
- **`rejected`**: Approver rejected the work
- **`sent_back`**: Approver sent back for revision
- **`forwarded`**: Approver forwarded to next level (intermediate step)

---

## 4. APPROVAL WORKFLOW FUNCTIONS

### `estimate.initiate_approval_workflow(p_work_id text)`

**Purpose**: Start the approval process for a work

**Parameters**:
- `p_work_id`: The work_id being submitted

**Logic Flow**:
1. Checks if current user is assigned to the work
2. Gets user's role from work_assignments
3. Calculates starting level based on user's role:
   - JE (role 10) → Level 1 → submits to Level 2 (SDE)
   - SDE (role 15) → Level 2 → submits to Level 3 (DE)
   - DE (role 16) → Level 3 → submits to Level 4 (EE)
4. Finds next approver at higher level
5. Creates approval_workflows record with `status = 'pending_approval'`
6. Creates initial approval_history entry with `action = 'submitted'`
7. Updates works.estimate_status to `'in_approval'`
8. Returns workflow_id (uuid)

**Error Handling**:
```
- "You are not assigned to this work..." - User not in work_assignments
- "No approver found for the next level..." - No higher-level engineer assigned
- "...already has an active approval workflow" - Workflow exists, can't submit again
- "...already been fully approved" - Work already fully approved
```

### `estimate.process_approval_action(p_workflow_id uuid, p_action text, p_comments text)`

**Purpose**: Process approver's action (approve/reject/send back)

**Parameters**:
- `p_workflow_id`: UUID of the workflow record
- `p_action`: One of: 'approved', 'rejected', 'sent_back'
- `p_comments`: Optional comments/reasons

**Action Logic**:

**If `p_action = 'approved'`**:
- If current_level < 4 (not final approver):
  - Find next approver at current_level + 1
  - Update workflow: current_level = next_level, current_approver_id = next_user
  - Create history with action = 'forwarded'
  - Work stays in 'in_approval' status
- If current_level = 4 (Executive Engineer - final):
  - Update workflow: status = 'approved', completed_at = now()
  - Update work: estimate_status = 'approved'
  - Create history with action = 'approved'

**If `p_action = 'rejected'`**:
- Update workflow: status = 'rejected', completed_at = now()
- Update work: estimate_status = 'rejected'
- Create history with action = 'rejected'
- Workflow ends (no re-submission possible without new workflow)

**If `p_action = 'sent_back'`**:
- Update workflow: status = 'sent_back', completed_at = now()
- Update work: estimate_status = 'sent_back'
- Create history with action = 'sent_back'
- User can then re-submit with new workflow

### `estimate.get_next_approver(p_work_id text, p_current_level integer)`

**Purpose**: Find the next approver in the hierarchy

**Parameters**:
- `p_work_id`: Work ID
- `p_current_level`: Current approval level (1-4)

**Returns**: Table with columns:
- `user_id`: UUID of next approver
- `role_id`: Role ID at next level
- `level`: Next level number

**Logic**:
1. Calculates next level = p_current_level + 1
2. If next level > 4, returns NULL (no more levels)
3. Maps level to role_id:
   - Level 1 → role_id 10 (JE)
   - Level 2 → role_id 15 (SDE)
   - Level 3 → role_id 16 (DE)
   - Level 4 → role_id 17 (EE)
4. Queries work_assignments for user with required role
5. Returns first match

---

## 5. PDF GENERATION & STORAGE MECHANISM

### PDF Generation Library
- **Library**: `jspdf` (v2.x) + `html2canvas`
- **Location**: [src/components/generate-estimate/EstimatePDFGenerator.tsx](src/components/generate-estimate/EstimatePDFGenerator.tsx)

### PDF Generation Flow

```typescript
const generatePDF = async () => {
  // 1. Create jsPDF instance (A4 Portrait, 210x297mm)
  const pdf = new jsPDF('p', 'mm', 'a4', true);
  
  // 2. Get all pages from printRef (DOM elements with class 'pdf-page')
  const pages = printRef.current.querySelectorAll('.pdf-page');
  
  // 3. For each page:
  for (let i = 0; i < pages.length; i++) {
    // a. Add new page if not first page
    if (i > 0) pdf.addPage();
    
    // b. Convert HTML to canvas using html2canvas
    const canvas = await html2canvas(pageElement, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 0
    });
    
    // c. Convert canvas to JPEG image data
    const imgData = canvas.toDataURL('image/jpeg', 0.85);
    
    // d. Add image to PDF page
    pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
    
    // e. Optionally add page numbers
    if (documentSettings.pageSettings.showPageNumbers) {
      pdf.text(pageText, x, y, { align: 'center' });
    }
  }
  
  // 4. Save file to local downloads
  const fileName = `Estimate_${workId}_${date}.pdf`;
  pdf.save(fileName); // Browser download
}
```

### PDF Storage
**CRITICAL FINDING**: PDFs are **NOT stored** in Supabase storage or database.
- Generated PDFs are **client-side only**
- User downloads to their local machine
- No server-side PDF persistence
- Each generation creates a fresh PDF

### Available Storage Buckets

While PDFs aren't stored, the application uses Supabase Storage for:

1. **`estimate-designs` bucket** (private)
   - Purpose: Store design photos for subworks
   - Used by: [src/components/generate-estimate/EstimatePDFGenerator.tsx](src/components/generate-estimate/EstimatePDFGenerator.tsx)
   - Table reference: `estimate.subwork_design_photos`
   - Columns:
     - `id`, `subwork_id`, `photo_url`, `photo_name`, `description`, `created_at`

### PDF Content Structure

Generated PDFs include the following pages:

1. **Cover Page**: Work title, estimated cost, location, fund head
2. **Lead Statement**: Lead charges for materials
3. **Rate Analysis**: Detailed rate breakdowns per item
4. **Subwork Details**: Item measurements and calculations
5. **Quarry Chart**: Visual quarry data (if applicable)
6. **Recap Sheet**: Final cost summary

### Document Settings (Customizable)

```typescript
interface DocumentSettings {
  header: {
    zilla: string;
    division: string;
    subDivision: string;
    title: string;
  };
  footer: {
    preparedBy: string;
    designation: string;
  };
  pageSettings: {
    showPageNumbers: boolean;
    pageNumberPosition: "top" | "bottom";
    marginTop: number;
    marginBottom: number;
  };
}
```

---

## 6. UI COMPONENTS INVOLVED IN APPROVAL PROCESS

### Main Components

#### 1. **`EstimateApprovalActions.tsx`**
- **Location**: [src/components/EstimateApprovalActions.tsx](src/components/EstimateApprovalActions.tsx)
- **Purpose**: Renders action buttons based on approval state
- **Props**:
  ```typescript
  interface EstimateApprovalActionsProps {
    workId: string;
    workType?: string;  // 'TA' or 'TS'
    currentStatus: string;
    onStatusUpdate: () => void;
  }
  ```

- **State Transitions & UI**:
  ```
  Draft → [Mark as Ready Button]
         ↓
  Ready for Approval → [Submit for Approval Button]
         ↓
  In Approval → [Status Badge: "In Approval"]
         ↓
  Approved → [Status Badge: "Approved" (Green)]
  
  OR
  
  Rejected → [Status Badge: "Rejected" (Red)]
  
  OR
  
  Sent Back → [Re-submit for Approval Button]
  ```

- **Functions**:
  - `handleMarkReady()`: Updates estimate_status to 'ready_for_approval'
  - `handleSubmitForApproval()`: Calls `initiate_approval_workflow` RPC
  - `checkWorkflow()`: Fetches current workflow status

#### 2. **`ApprovalDashboard.tsx`**
- **Location**: [src/components/ApprovalDashboard.tsx](src/components/ApprovalDashboard.tsx)
- **Purpose**: Main approval management interface for approvers
- **Features**:
  - Lists all works with approval status
  - Shows approval pipeline visualization (JE → SDE → DE → EE)
  - Filters by work type (TA/TS), status, year
  - "Pending for Me" tab shows only works awaiting current user's approval
  - History sidebar with full approval audit trail

- **Key Data Structures**:
  ```typescript
  interface WorkflowData {
    id: string;
    work_id: string;
    current_level: number;
    current_approver_id: string;
    status: string;
    initiated_by: string;
    initiated_at: string;
  }
  
  interface HistoryEntry {
    id: string;
    workflow_id: string;
    level: number;
    approver_id: string;
    action: string;
    comments: string | null;
    created_at: string;
    approver_name?: string;
    role_name?: string;
  }
  ```

- **Pipeline Visualization**:
  ```
  Level 1 (JE) → Level 2 (SDE) → Level 3 (DE) → Level 4 (EE)
  
  Color Coding:
  - Green: Completed (or final approval)
  - Amber: Current level (pending)
  - Red: Rejected/Sent Back
  - Gray: Future levels
  ```

- **Approval Actions**:
  - **Approve**: Move to next level (or finalize if Level 4)
  - **Reject**: End workflow with rejection status
  - **Send Back**: End workflow with sent_back status (allows re-submission)

#### 3. **`EstimatePDFGenerator.tsx`**
- **Location**: [src/components/generate-estimate/EstimatePDFGenerator.tsx](src/components/generate-estimate/EstimatePDFGenerator.tsx)
- **Purpose**: Generates downloadable PDF estimates
- **Features**:
  - Multi-page PDF generation
  - Document settings panel (header, footer, page numbers)
  - Live preview before generation
  - Customizable "Prepared By" and designation fields

---

## 7. APPROVAL WORKFLOW SEQUENCE DIAGRAM

```
┌─────────┐           ┌──────────────────────┐           ┌────────────┐
│  JE     │           │  SDE                 │           │ DE / EE    │
│(Submits)│           │(Reviews)             │           │(Final Review)
└────┬────┘           └──────────┬───────────┘           └────────┬───┘
     │                           │                             │
     │ 1. Mark Ready             │                             │
     │ (estimate_status=ready)   │                             │
     │                           │                             │
     │ 2. Submit for Approval    │                             │
     │ (RPC: initiate_approval_  │                             │
     │      workflow)            │                             │
     │         │                 │                             │
     │         ├─ Create Workflow│                             │
     │         │  (status=pending)                             │
     │         │  (level=2)      │                             │
     │         │  (current_approver=SDE)                       │
     │         │                 │                             │
     │         └─ Create History │                             │
     │            (action=submitted)                           │
     │                           │                             │
     │                           │ 3. Email/Notification       │
     │                           │    (Current approver notified)
     │                           │                             │
     │ work.estimate_status = 'in_approval'                   │
     │                           │                             │
     │                    [SDE Reviews]                        │
     │                           │                             │
     │                    4. Approve (Forward)                 │
     │                    (RPC: process_approval_action)       │
     │                           │                             │
     │                           ├─ Update Workflow            │
     │                           │  (current_level = 3)        │
     │                           │  (current_approver = DE)    │
     │                           │                             │
     │                           ├─ Create History            │
     │                           │  (action=forwarded)         │
     │                           │                             │
     │                           │ 5. Email to DE              │
     │                           │                             │
     │                           │                    [DE Reviews]
     │                           │                             │
     │                           │            6a. Approve (Forward) or
     │                           │                6b. Reject/Send Back
     │                           │                             │
     │ ◄─ REJECTED ──────────────┼─────────────────────────────┤
     │    OR SENT_BACK           │                             │
     │    (Can re-submit)        │                             │
     │                           │            6c. Approve (Final)
     │                           │            (if current_level = 4)
     │                           │                             │
     │ ◄─ FULLY APPROVED ────────┼─────────────────────────────┤
     │ (estimate_status=approved)│                             │
     │                           │                             │
```

---

## 8. KEY ISSUES & FINDINGS

### Issue 1: **Missing `work_type` Column in Database**
- **Status**: 🔴 CRITICAL
- **Location**: `estimate.approval_workflows` table
- **Problem**: 
  - UI code passes `work_type` parameter ('TA' or 'TS') to distinguish Technical Approval vs Technical Sanction
  - Frontend filters workflows by `work_type` (line 31 in EstimateApprovalActions.tsx)
  - Database schema doesn't include `work_type` column
  - This will cause query errors when filtering: `.eq('work_type', workType)`
- **Files Affected**:
  - [src/components/EstimateApprovalActions.tsx](src/components/EstimateApprovalActions.tsx) - lines 23-32
  - [src/components/ApprovalDashboard.tsx](src/components/ApprovalDashboard.tsx) - line 384

- **Solution Required**: 
  Add migration to add `work_type` column to `approval_workflows` table

### Issue 2: **PDFs Not Persisted**
- **Status**: ℹ️ DESIGN DECISION
- **Finding**: Generated estimate PDFs are:
  - Client-side only (generated in browser using jspdf + html2canvas)
  - Downloaded to user's local machine
  - NOT stored on Supabase or in database
  - Lost after browser session
- **Impact**: 
  - No audit trail of PDF versions
  - Can't retrieve previously generated PDFs
  - Storage bucket exists but isn't used for PDFs

### Issue 3: **Inconsistent RPC Function Parameters**
- **Status**: 🟡 MODERATE
- **Problem**: 
  - `initiate_approval_workflow` is called with `p_work_type` parameter
  - Function signature doesn't accept this parameter in migration 20251220185157
  - Creates mismatch between UI and database function
- **Files Affected**:
  - [src/components/EstimateApprovalActions.tsx](src/components/EstimateApprovalActions.tsx) - line 67

---

## 9. APPROVAL WORKFLOW SUMMARY TABLE

| Stage | Status | estimate_status | Current User | Action | Next Level |
|-------|--------|---|---|---|---|
| Preparation | N/A | `draft` | Junior Engineer | Mark as Ready | N/A |
| Ready | N/A | `ready_for_approval` | Junior Engineer | Submit for Approval | Level 2 (SDE) |
| Level 2 Review | `pending_approval` | `in_approval` | SDE | Approve/Reject/Send Back | Level 3 (DE) or End |
| Level 3 Review | `pending_approval` | `in_approval` | DE | Approve/Reject/Send Back | Level 4 (EE) or End |
| Level 4 Review | `pending_approval` | `in_approval` | EE | Approve/Reject/Send Back | Final or End |
| Final | `approved` | `approved` | N/A | N/A | Workflow Complete ✓ |
| Rejected | `rejected` | `rejected` | N/A | N/A | Workflow Ended ✗ |
| Revision | `sent_back` | `sent_back` | Junior Engineer | Re-submit | Back to Level 2 |

---

## 10. DATABASE INDEXES

Created for performance optimization:

```sql
CREATE INDEX idx_approval_workflows_work_id ON estimate.approval_workflows(work_id);
CREATE INDEX idx_approval_workflows_current_approver ON estimate.approval_workflows(current_approver_id);
CREATE INDEX idx_approval_workflows_status ON estimate.approval_workflows(status);
CREATE INDEX idx_approval_history_workflow_id ON estimate.approval_history(workflow_id);
CREATE INDEX idx_approval_history_work_id ON estimate.approval_history(work_id);
CREATE INDEX idx_approval_history_approver_id ON estimate.approval_history(approver_id);
```

---

## 11. ROW-LEVEL SECURITY (RLS) POLICIES

### For `approval_workflows` Table

**SELECT Policy**: Users can view workflows for:
- Works they're assigned to
- Workflows they initiated
- Workflows where they're current approver
- Admin/super_admin/developer roles (unrestricted)

**INSERT Policy**: Users can create workflows for:
- Works they're assigned to
- If they're admin/super_admin/developer

**UPDATE Policy**: Can update if:
- User is current approver
- User is admin/super_admin/developer

### For `approval_history` Table

**SELECT Policy**: Users can view history for:
- Works they're assigned to
- Workflows they're involved in
- Admin/super_admin/developer roles

**INSERT Policy**: Authenticated users can create (via functions only)

---

## 12. RECOMMENDATIONS

1. ✅ **Add `work_type` column** to `approval_workflows` table
2. ✅ **Implement PDF persistence** - Consider storing approval-locked PDFs to Supabase Storage
3. ✅ **Add webhook/email notifications** for approvers when work reaches them
4. ✅ **Create audit log views** for compliance and tracking
5. ✅ **Add approval SLA tracking** - Monitor how long each approval takes
6. ✅ **Implement bulk actions** for approvers managing multiple works
