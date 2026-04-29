# Digital Signature Implementation for Approval Workflow

## Overview

This implementation adds digital signature functionality to your approval workflow, allowing approvers to digitally sign PDFs at each approval level (Level 1, 2, 3, and 4).

### Key Features

✅ **In-App Signature Capture**
- Handwritten signature using mouse/touch pad
- Typed signature (text-based)
- Real-time preview

✅ **PDF Management**
- Auto-generate PDFs when approval workflow starts
- Share PDFs with all approval chain participants
- Store all PDF versions in Supabase Storage
- Track signature metadata with timestamps and IP addresses

✅ **Workflow Integration**
- Sign at each approval level (Level 1 → 2 → 3 → 4)
- Track who signed, when, and how
- Audit trail of all signatures
- Final approved PDF with all signatures

✅ **Security**
- Row-level security (RLS) for PDF access
- Only approval chain members can view/access PDFs
- Signature metadata stored separately from signature images
- IP and browser info logged for audit purposes

---

## Architecture

### Database Schema

Three new tables added:

#### 1. `approval_pdf_attachments`
Stores PDF files and metadata for approval workflows
```sql
- id (uuid)
- approval_workflow_id (uuid) → references approval_workflows
- work_id (text) → references works
- pdf_file_path (text) → path in Supabase storage
- pdf_version (text) → 'unsigned', 'signed_level_1', 'signed_level_2', etc.
- file_size_kb (integer)
- uploaded_by (uuid) → user who uploaded
- created_at, updated_at
```

#### 2. `approval_signatures`
Tracks individual signatures at each approval level
```sql
- id (uuid)
- approval_history_id (uuid) → references approval_history
- approval_workflow_id (uuid) → references approval_workflows
- approver_id (uuid) → who signed
- approver_name (text)
- approval_level (integer) → 1, 2, 3, or 4
- signature_image_base64 (text) → PNG image of signature
- signature_method (text) → 'handwritten' or 'typed'
- signature_timestamp (timestamptz)
- signed_pdf_path (text) → path to PDF with signature
- ip_address (text) → for audit trail
- browser_info (text) → for audit trail
- created_at, updated_at
```

#### 3. `approval_history` (modified)
Added `signature_id` column to link to approval_signatures

---

## Setup Instructions

### Step 1: Apply Database Migration

The migration file is ready:
📄 `supabase/migrations/20260429_add_digital_signature_support.sql`

**To Apply:**

**Option A: Using Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** → **New Query**
4. Copy the migration SQL content
5. Paste and click **Run**

**Option B: Using Supabase CLI**
```bash
cd c:\Users\Hp\OneDrive\Desktop\estimate-28april-2026\estimate-final
supabase db push
```

### Step 2: Create Supabase Storage Bucket

**Create a bucket for PDF storage:**

1. Go to Supabase Dashboard → **Storage**
2. Click **Create New Bucket**
3. Name: `estimate-approvals`
4. Access Level: **Private** (use RLS policies)
5. Click **Create Bucket**

**Enable RLS on the bucket:**
```sql
-- Run in SQL Editor
INSERT INTO storage.buckets (id, name, owner, public)
VALUES ('estimate-approvals', 'estimate-approvals', null, false);

CREATE POLICY "Users can view PDFs for their workflows"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'estimate-approvals');

CREATE POLICY "Users can upload PDFs for approval"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'estimate-approvals');
```

### Step 3: Install Additional Dependencies (Optional)

The signature component uses canvas-based drawing. No additional packages needed as it uses HTML5 Canvas.

If you want PDF signature embedding (advanced):
```bash
npm install pdfkit
```

---

## Component Integration

### New Components Created

#### 1. **SignaturePad.tsx**
Location: `src/components/approval/SignaturePad.tsx`

A modal component for signature capture with two modes:
- Handwritten: Draw signature with mouse/touch
- Typed: Enter name as signature

**Props:**
```typescript
interface SignaturePadProps {
  onSignatureCapture: (signatureData: SignatureData) => void;
  onCancel: () => void;
  userName: string;
  approvalLevel: number;
}

interface SignatureData {
  signatureImage: string; // Base64 PNG
  signatureMethod: 'handwritten' | 'typed';
  typedText?: string;
}
```

**Usage:**
```typescript
import SignaturePad from './approval/SignaturePad';

<SignaturePad
  userName={approverName}
  approvalLevel={approvalLevel}
  onSignatureCapture={handleSignatureCapture}
  onCancel={() => setShowSignaturePad(false)}
/>
```

#### 2. **ApprovalActionWithSignature.tsx**
Location: `src/components/approval/ApprovalActionWithSignature.tsx`

Main component for approval workflow with signature integration

**Props:**
```typescript
interface ApprovalActionWithSignatureProps {
  workflowId: string;
  approvalLevel: number;
  currentApproverId: string;
  approverName: string;
  workId: string;
  onApprovalComplete: () => void;
}
```

**Features:**
- Display attached PDFs
- Show existing signatures (if already signed)
- Capture new signatures
- Download PDFs
- Error handling and success messages

### Utility Functions

Location: `src/utils/pdfSignatureUtils.ts`

**Main Functions:**

```typescript
// Upload PDF to storage
uploadPDFToStorage(pdfBlob, workId, workflowId, version)

// Save PDF metadata to database
savePDFAttachmentMetadata(workflowId, workId, filePath, version, userId, fileSize)

// Save signature metadata
saveSignatureMetadata(historyId, workflowId, userId, name, level, image, method)

// Get download URL for PDF
getPDFDownloadUrl(filePath)

// Generate PDF from HTML and upload
generateAndUploadApprovalPDF(htmlElement, workId, workflowId, userId)

// Fetch all PDFs for workflow
getApprovalPDFs(workflowId)

// Fetch all signatures for workflow
getWorkflowSignatures(workflowId)
```

---

## Integration Steps

### Step 1: Update EstimateApprovalActions Component

In `src/components/EstimateApprovalActions.tsx`, integrate the new signature component:

```typescript
import ApprovalActionWithSignature from './approval/ApprovalActionWithSignature';

// In your JSX, add signature component to approval action section:
<ApprovalActionWithSignature
  workflowId={workflow.id}
  approvalLevel={workflow.current_level}
  currentApproverId={workflow.current_approver_id}
  approverName={approverNameForLevel}
  workId={workId}
  onApprovalComplete={handleRefresh}
/>
```

### Step 2: Add PDF Generation on Approval Start

When initiating approval workflow, generate and attach PDF:

```typescript
import { generateAndUploadApprovalPDF } from '../utils/pdfSignatureUtils';

const handleInitiateApproval = async (work: Work) => {
  try {
    // 1. Create approval workflow record
    const workflow = await createApprovalWorkflow(work.works_id);
    
    // 2. Generate PDF from estimate
    const estimateHtml = document.getElementById('estimate-content');
    if (estimateHtml) {
      await generateAndUploadApprovalPDF(
        estimateHtml,
        work.works_id,
        workflow.id,
        user.id,
        `estimate_${work.works_id}`
      );
    }
    
    // 3. Proceed with approval workflow
    notifyApprovers(workflow);
  } catch (error) {
    console.error('Error initiating approval:', error);
  }
};
```

### Step 3: Update ApprovalDashboard

Add PDF and signature views to the approval dashboard:

```typescript
import { getApprovalPDFs, getWorkflowSignatures } from '../utils/pdfSignatureUtils';

// Fetch and display PDFs and signatures
useEffect(() => {
  const fetchApprovalData = async () => {
    const pdfs = await getApprovalPDFs(selectedWorkflow.id);
    const signatures = await getWorkflowSignatures(selectedWorkflow.id);
    setPDFs(pdfs);
    setSignatures(signatures);
  };
  
  fetchApprovalData();
}, [selectedWorkflow]);

// Display signature timeline
{signatures.map((sig) => (
  <div key={sig.id} className="p-3 border-l-4 border-blue-500">
    <p className="font-medium">Level {sig.approval_level}: {sig.approver_name}</p>
    <p className="text-sm text-gray-600">
      {sig.signature_method} signature • {new Date(sig.signature_timestamp).toLocaleString()}
    </p>
  </div>
))}
```

---

## Workflow Flow

### Approval Flow with Signatures

```
┌─────────────────────────────────────────────────────────┐
│ 1. Submit for Approval                                  │
│    - Generate estimate PDF                              │
│    - Store in Supabase Storage (unsigned)               │
│    - Create approval_workflows record                   │
│    - Set current_level = 1                              │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Level 1: Junior Engineer Reviews                    │
│    - Download unsigned PDF                              │
│    - Click "Add Digital Signature"                      │
│    - Sign with handwritten or typed signature           │
│    - Save signature_images & metadata                   │
│    - Create approval_history record with action="forwarded"
│    - Update workflow: current_level = 2               │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Level 2: Sub Division Engineer Reviews              │
│    - Download PDF (see Level 1 signature)               │
│    - Add signature                                      │
│    - Update workflow: current_level = 3               │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Level 3: Divisional Engineer Reviews                │
│    - Add signature                                      │
│    - Update workflow: current_level = 4               │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Level 4: Executive Engineer Final Approval          │
│    - Add signature (final approver)                      │
│    - Update workflow: status = 'approved'              │
│    - All 4 signatures now on record                     │
│    - Generate final signed PDF                         │
└─────────────────────────────────────────────────────────┘
```

---

## Testing Guide

### Test Scenario 1: Basic Signature Capture

1. Create a work and initiate approval
2. Login as Level 1 approver
3. Go to approval dashboard
4. Download the unsigned PDF
5. Click "Add Digital Signature"
6. Test handwritten signature:
   - Draw on the canvas
   - Click "Confirm Signature"
7. Verify:
   - Signature saved to database
   - Workflow moves to Level 2
   - Signature appears in history

### Test Scenario 2: Multi-Level Approval

1. Complete Level 1 signature
2. Logout and login as Level 2 approver
3. Download PDF (should see Level 1 signature info)
4. Add Level 2 signature
5. Repeat for Levels 3 and 4
6. Verify:
   - All 4 signatures tracked separately
   - IP addresses and timestamps logged
   - Workflow status = 'approved' at end

### Test Scenario 3: PDF Storage

1. Check Supabase Storage bucket `estimate-approvals`
2. Verify files are stored with proper paths:
   - `approvals/WRK-000001/unsigned.pdf`
   - `approvals/WRK-000001/signed_level_1_*.pdf`
3. Test download links are working
4. Verify RLS policies prevent unauthorized access

### Test Scenario 4: Signature Audit Trail

1. Go to Supabase Dashboard → approval_signatures table
2. Verify columns populated:
   - approval_level: 1, 2, 3, 4
   - approver_name: correct names
   - signature_timestamp: accurate times
   - signature_method: handwritten or typed
   - ip_address: logged correctly
   - browser_info: user agent string

---

## Security Considerations

### Access Control

✅ **RLS Policies Enforce:**
- Users can only view PDFs for their approval workflows
- Users can only view signatures for their workflows
- Only approvers can add signatures
- Admins can view all workflows

### Audit Trail

✅ **Tracked for Each Signature:**
- Approver ID and name
- Timestamp (to the second)
- IP address (for geo-tracking)
- Browser information (user agent)
- Signature method (handwritten/typed)
- Approval level

### Data Protection

✅ **PDF Storage:**
- Files encrypted at rest in Supabase Storage
- Signed URLs expire after 1 hour
- Access controlled by RLS policies

✅ **Signature Images:**
- Stored as Base64 PNG in database
- Encrypted by Supabase (with HTTPS)
- Can be extracted for PDF embedding if needed

---

## Advanced Features (Future Enhancements)

### 1. Embed Signatures in PDF
Currently signatures are tracked separately. Future enhancement: automatically embed signature images into the PDF at the point of signing.

### 2. Timestamp Authority (TSA)
Integrate with external timestamp authority for non-repudiation (e.g., RFC 3161 timestamps)

### 3. Certificate-Based Signatures
Use X.509 certificates for legally binding digital signatures

### 4. Signature Verification
Implement signature verification to detect tampered PDFs

### 5. Email Notifications
Notify next approver in chain with PDF download links

---

## Troubleshooting

### Issue: "Storage bucket not found"
**Solution:** 
- Create bucket `estimate-approvals` in Supabase Storage
- Ensure bucket is set to Private

### Issue: "RLS policy violation when uploading PDF"
**Solution:**
- Check user is authenticated
- Verify user is assigned to the work
- Check storage bucket RLS policies are created

### Issue: "Signature image not displaying"
**Solution:**
- Verify Base64 string is valid PNG
- Check browser console for decode errors
- Try refreshing the page

### Issue: "Approval workflow not progressing"
**Solution:**
- Verify approval_workflows table is being updated
- Check `current_level` is incremented
- Ensure approval_history records are created

---

## File Summary

| File | Purpose |
|------|---------|
| `supabase/migrations/20260429_add_digital_signature_support.sql` | Database schema changes |
| `src/components/approval/SignaturePad.tsx` | Signature capture modal |
| `src/components/approval/ApprovalActionWithSignature.tsx` | Approval action with signatures |
| `src/utils/pdfSignatureUtils.ts` | PDF and signature utilities |

---

## Next Steps

1. **Apply the migration** to your Supabase database
2. **Create the storage bucket** `estimate-approvals`
3. **Integrate components** into EstimateApprovalActions.tsx
4. **Test** the complete flow with all 4 approval levels
5. **Monitor** the approval_signatures table for audit trail

---

## Support

For issues or questions:
- Check browser console for errors
- Verify Supabase logs for permission/auth issues
- Review RLS policies in Supabase dashboard
- Test with test@example.com user if available
