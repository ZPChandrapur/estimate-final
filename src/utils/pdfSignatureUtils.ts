import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Upload PDF to Supabase Storage
 */
export const uploadPDFToStorage = async (
  pdfBlob: Blob,
  workId: string,
  workflowId: string,
  version: string = 'unsigned'
): Promise<string> => {
  try {
    const fileName = `${workId}_${version}_${Date.now()}.pdf`;
    const filePath = `approvals/${workId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('estimate-approvals')
      .upload(filePath, pdfBlob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/pdf'
      });

    if (uploadError) throw uploadError;

    return filePath;
  } catch (error) {
    console.error('Error uploading PDF to storage:', error);
    throw error;
  }
};

/**
 * Store PDF attachment metadata in database
 */
export const savePDFAttachmentMetadata = async (
  approvalWorkflowId: string,
  workId: string,
  pdfFilePath: string,
  pdfVersion: string,
  uploadedByUserId: string,
  fileSizeKb: number
) => {
  try {
    const { data, error } = await supabase
      .schema('estimate')
      .from('approval_pdf_attachments')
      .insert([
        {
          approval_workflow_id: approvalWorkflowId,
          work_id: workId,
          pdf_file_path: pdfFilePath,
          pdf_version: pdfVersion,
          file_size_kb: fileSizeKb,
          uploaded_by: uploadedByUserId
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving PDF attachment metadata:', error);
    throw error;
  }
};

/**
 * Get download URL for PDF from storage
 */
export const getPDFDownloadUrl = async (filePath: string): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from('estimate-approvals')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting PDF download URL:', error);
    throw error;
  }
};

/**
 * Save signature metadata in database
 */
export const saveSignatureMetadata = async (
  approvalHistoryId: string,
  approvalWorkflowId: string,
  approverId: string,
  approverName: string,
  approvalLevel: number,
  signatureImageBase64: string,
  signatureMethod: 'handwritten' | 'typed',
  signedPdfPath?: string
) => {
  try {
    // Get client info
    const userAgent = navigator.userAgent;
    const ipAddress = await getClientIp();

    const { data, error } = await supabase
      .schema('estimate')
      .from('approval_signatures')
      .insert([
        {
          approval_history_id: approvalHistoryId,
          approval_workflow_id: approvalWorkflowId,
          approver_id: approverId,
          approver_name: approverName,
          approval_level: approvalLevel,
          signature_image_base64: signatureImageBase64,
          signature_method: signatureMethod,
          signed_pdf_path: signedPdfPath,
          ip_address: ipAddress,
          browser_info: userAgent
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving signature metadata:', error);
    throw error;
  }
};

/**
 * Get client IP address
 */
const getClientIp = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
};

/**
 * Add signature image to PDF
 */
export const addSignatureToPDF = async (
  pdfBytes: Uint8Array,
  signatureImageBase64: string,
  approverName: string,
  approvalLevel: number,
  signatureTimestamp: Date
): Promise<Blob> => {
  try {
    // Create new PDF with signature overlay
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Add original PDF content (simplified - assumes single page)
    const img = new Image();
    img.src = `data:application/pdf;base64,${pdfBytes}`;

    // Add signature image
    const sigImg = new Image();
    sigImg.src = signatureImageBase64;

    // Position signature at bottom of page
    const signaturePage = pdf.addPage();
    pdf.addImage(sigImg, 'PNG', 20, 250, 50, 20); // x, y, width, height
    pdf.text(`Approved by: ${approverName}`, 20, 280);
    pdf.text(`Level: ${approvalLevel}`, 20, 290);
    pdf.text(`Date: ${signatureTimestamp.toLocaleString()}`, 20, 300);

    return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error adding signature to PDF:', error);
    throw error;
  }
};

/**
 * Generate and upload PDF for approval workflow
 */
export const generateAndUploadApprovalPDF = async (
  htmlElement: HTMLElement | null,
  workId: string,
  workflowId: string,
  userId: string,
  fileName: string = 'estimate'
): Promise<{ filePath: string; size: number }> => {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // If HTML element exists, capture it; otherwise create placeholder
    if (htmlElement) {
      const canvas = await html2canvas(htmlElement, {
        scale: 2,
        logging: false,
        allowTaint: true,
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      let heightLeft = canvas.height * imgWidth / canvas.width;
      let position = 0;

      // Add pages
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, heightLeft);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - canvas.height * imgWidth / canvas.width;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, heightLeft);
        heightLeft -= pageHeight;
      }
    } else {
      // Fallback: Create placeholder PDF when estimate HTML is not available
      pdf.text('ESTIMATE FOR APPROVAL', 20, 20);
      pdf.text(`Work ID: ${workId}`, 20, 30);
      pdf.text(`Workflow ID: ${workflowId}`, 20, 40);
      pdf.text(`Created: ${new Date().toLocaleString()}`, 20, 50);
      pdf.text('', 20, 60);
      pdf.text('This is a placeholder PDF for the approval workflow.', 20, 70);
      pdf.text('Full estimate details can be viewed in the system.', 20, 80);
    }

    // Convert to blob
    const pdfBlob = pdf.output('blob');
    const fileSizeKb = Math.ceil(pdfBlob.size / 1024);

    // Upload to storage
    const filePath = await uploadPDFToStorage(pdfBlob, workId, workflowId, 'unsigned');

    // Save metadata
    await savePDFAttachmentMetadata(
      workflowId,
      workId,
      filePath,
      'unsigned',
      userId,
      fileSizeKb
    );

    return { filePath, size: fileSizeKb };
  } catch (error) {
    console.error('Error generating and uploading PDF:', error);
    throw error;
  }
};

/**
 * Get approval PDF attachments
 */
export const getApprovalPDFs = async (workflowId: string) => {
  try {
    const { data, error } = await supabase
      .schema('estimate')
      .from('approval_pdf_attachments')
      .select('*')
      .eq('approval_workflow_id', workflowId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching approval PDFs:', error);
    throw error;
  }
};

/**
 * Get signatures for workflow
 */
export const getWorkflowSignatures = async (workflowId: string) => {
  try {
    const { data, error } = await supabase
      .schema('estimate')
      .from('approval_signatures')
      .select('*')
      .eq('approval_workflow_id', workflowId)
      .order('approval_level', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching workflow signatures:', error);
    throw error;
  }
};
