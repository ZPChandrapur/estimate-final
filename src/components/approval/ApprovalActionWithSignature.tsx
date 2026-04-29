import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SignaturePad, { SignatureData } from './approval/SignaturePad';
import {
  saveSignatureMetadata,
  getApprovalPDFs,
  getPDFDownloadUrl,
  uploadPDFToStorage,
  savePDFAttachmentMetadata
} from '../utils/pdfSignatureUtils';
import { Download, Signature, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ApprovalActionWithSignatureProps {
  workflowId: string;
  approvalLevel: number;
  currentApproverId: string;
  approverName: string;
  workId: string;
  onApprovalComplete: () => void;
}

const ApprovalActionWithSignature: React.FC<ApprovalActionWithSignatureProps> = ({
  workflowId,
  approvalLevel,
  currentApproverId,
  approverName,
  workId,
  onApprovalComplete
}) => {
  const { user } = useAuth();
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [attachedPDFs, setAttachedPDFs] = useState<any[]>([]);
  const [existingSignature, setExistingSignature] = useState<any>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch PDFs and signatures for this workflow
  useEffect(() => {
    fetchWorkflowData();
  }, [workflowId]);

  const fetchWorkflowData = async () => {
    try {
      setLoading(true);

      // Fetch attached PDFs
      const { data: pdfData, error: pdfError } = await supabase
        .schema('estimate')
        .from('approval_pdf_attachments')
        .select('*')
        .eq('approval_workflow_id', workflowId);

      if (pdfError) throw pdfError;
      setAttachedPDFs(pdfData || []);

      // Check if current user has already signed
      const { data: signatureData, error: sigError } = await supabase
        .schema('estimate')
        .from('approval_signatures')
        .select('*')
        .eq('approval_workflow_id', workflowId)
        .eq('approval_level', approvalLevel)
        .maybeSingle();

      if (sigError) throw sigError;
      setExistingSignature(signatureData);
    } catch (err: any) {
      setError(`Error fetching workflow data: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureCapture = async (signatureData: SignatureData) => {
    try {
      setIsApproving(true);
      setError(null);

      if (!user) throw new Error('User not authenticated');

      // Get the unsigned PDF to add signature to
      const unsignedPDF = attachedPDFs.find(p => p.pdf_version === 'unsigned' || p.pdf_version === `signed_level_${approvalLevel - 1}`);

      if (!unsignedPDF) {
        throw new Error('No PDF found to sign');
      }

      // For now, we'll store the signature metadata
      // In production, you'd add the signature image to the PDF and re-upload
      const { data: approvalHistory, error: historyError } = await supabase
        .schema('estimate')
        .from('approval_history')
        .select('id')
        .eq('workflow_id', workflowId)
        .eq('approval_level', approvalLevel)
        .eq('action', 'submitted')
        .maybeSingle();

      if (historyError) throw historyError;

      const approvalHistoryId = approvalHistory?.id || (await createApprovalHistoryRecord());

      // Save signature metadata
      const signature = await saveSignatureMetadata(
        approvalHistoryId,
        workflowId,
        user.id,
        approverName,
        approvalLevel,
        signatureData.signatureImage,
        signatureData.signatureMethod,
        unsignedPDF.pdf_file_path
      );

      // Update approval workflow to next level or mark as approved
      const isLastLevel = approvalLevel === 4; // Executive Engineer
      const { error: updateError } = await supabase
        .schema('estimate')
        .from('approval_workflows')
        .update({
          current_level: isLastLevel ? 4 : approvalLevel + 1,
          status: isLastLevel ? 'approved' : 'in_approval',
          current_approver_id: isLastLevel ? user.id : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', workflowId);

      if (updateError) throw updateError;

      // Add completion record to approval history
      const { error: historyInsertError } = await supabase
        .schema('estimate')
        .from('approval_history')
        .insert([
          {
            workflow_id: workflowId,
            approval_level: approvalLevel,
            approver_id: user.id,
            action: isLastLevel ? 'approved' : 'forwarded',
            comments: `Approved with ${signatureData.signatureMethod} signature`,
            signature_id: signature.id,
            created_at: new Date().toISOString()
          }
        ]);

      if (historyInsertError) throw historyInsertError;

      setSuccessMessage(`Approval with signature recorded at Level ${approvalLevel}`);
      setShowSignaturePad(false);
      setExistingSignature(signature);

      // Refresh workflow data
      setTimeout(() => {
        fetchWorkflowData();
        onApprovalComplete();
      }, 1500);
    } catch (err: any) {
      setError(`Error processing signature: ${err.message}`);
      console.error(err);
    } finally {
      setIsApproving(false);
    }
  };

  const createApprovalHistoryRecord = async (): Promise<string> => {
    const { data, error } = await supabase
      .schema('estimate')
      .from('approval_history')
      .insert([
        {
          workflow_id: workflowId,
          approval_level: approvalLevel,
          approver_id: user?.id,
          action: 'submitted',
          created_at: new Date().toISOString()
        }
      ])
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  };

  const downloadPDF = async (pdfPath: string, fileName: string) => {
    try {
      const url = await getPDFDownloadUrl(pdfPath);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
    } catch (err: any) {
      setError(`Error downloading PDF: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="p-4 text-gray-500">Loading approval status...</div>;
  }

  // If user is not the current approver, show read-only view
  const isCurrentApprover = user?.id === currentApproverId;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Level {approvalLevel} Approval - {approverName}
        </h3>
        {existingSignature && (
          <span className="flex items-center text-green-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Signed
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          ✓ {successMessage}
        </div>
      )}

      {/* Attached PDFs */}
      {attachedPDFs.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Attached Documents</h4>
          <div className="space-y-2">
            {attachedPDFs.map((pdf) => (
              <div key={pdf.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{pdf.pdf_version}</p>
                  <p className="text-xs text-gray-500">{pdf.file_size_kb} KB</p>
                </div>
                <button
                  onClick={() => downloadPDF(pdf.pdf_file_path, `estimate_${pdf.pdf_version}.pdf`)}
                  className="inline-flex items-center px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition text-sm"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signature Info */}
      {existingSignature && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Signature Information</h4>
          <div className="p-3 bg-blue-50 rounded-lg space-y-2 text-sm">
            <p>
              <span className="font-medium">Method:</span>{' '}
              <span className="capitalize">{existingSignature.signature_method}</span>
            </p>
            <p>
              <span className="font-medium">Signed:</span>{' '}
              {new Date(existingSignature.signature_timestamp).toLocaleString()}
            </p>
            {existingSignature.signature_image_base64 && (
              <div>
                <p className="font-medium mb-2">Signature Preview:</p>
                <img
                  src={existingSignature.signature_image_base64}
                  alt="Signature"
                  className="max-w-xs border border-gray-300 rounded"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Signature Capture Button */}
      {isCurrentApprover && !existingSignature && (
        <div className="border-t pt-4">
          <button
            onClick={() => setShowSignaturePad(true)}
            disabled={isApproving || attachedPDFs.length === 0}
            className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium gap-2"
          >
            <Signature className="w-5 h-5" />
            Add Digital Signature
          </button>
          {attachedPDFs.length === 0 && (
            <p className="text-xs text-gray-500 mt-2">PDF must be attached before signing</p>
          )}
        </div>
      )}

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <SignaturePad
          userName={approverName}
          approvalLevel={approvalLevel}
          onSignatureCapture={handleSignatureCapture}
          onCancel={() => setShowSignaturePad(false)}
        />
      )}
    </div>
  );
};

export default ApprovalActionWithSignature;
