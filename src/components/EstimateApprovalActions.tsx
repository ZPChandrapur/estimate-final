import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, CheckCircle, XCircle, RotateCcw, Clock, AlertCircle } from 'lucide-react';

interface EstimateApprovalActionsProps {
  workId: string;
  currentStatus: string;
  onStatusUpdate: () => void;
}

type WorkflowStatus = 'pending_approval' | 'approved' | 'rejected' | 'sent_back' | null;

const EstimateApprovalActions: React.FC<EstimateApprovalActionsProps> = ({ workId, currentStatus, onStatusUpdate }) => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>(null);
  const [loadingWorkflow, setLoadingWorkflow] = useState(true);

  useEffect(() => {
    checkWorkflow();
  }, [workId, currentStatus]);

  const checkWorkflow = async () => {
    try {
      setLoadingWorkflow(true);
      // Get the most recent workflow for this work
      const { data } = await supabase
        .schema('estimate')
        .from('approval_workflows')
        .select('id, status')
        .eq('work_id', workId)
        .order('initiated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setWorkflowStatus(data?.status ?? null);
    } catch (error) {
      console.error('Error checking workflow:', error);
      setWorkflowStatus(null);
    } finally {
      setLoadingWorkflow(false);
    }
  };

  const handleMarkReady = async () => {
    try {
      setSubmitting(true);
      const { error } = await supabase
        .schema('estimate')
        .from('works')
        .update({ estimate_status: 'ready_for_approval' })
        .eq('works_id', workId);
      if (error) throw error;
      onStatusUpdate();
    } catch (error: any) {
      alert('Failed to mark as ready: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!confirm('Submit this estimate for approval? Once submitted, the assigned approver will review it.')) return;
    try {
      setSubmitting(true);
      const { error } = await supabase.schema('estimate').rpc('initiate_approval_workflow', { p_work_id: workId });
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

  if (loadingWorkflow) return null;

  // ── Terminal states ──────────────────────────────────────────────────────

  if (currentStatus === 'approved' || workflowStatus === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
        <CheckCircle className="w-3 h-3" />
        Approved
      </span>
    );
  }

  if (currentStatus === 'rejected' || workflowStatus === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
        <XCircle className="w-3 h-3" />
        Rejected
      </span>
    );
  }

  // ── Sent back — workflow exists but needs re-submission ──────────────────

  if (currentStatus === 'sent_back' || workflowStatus === 'sent_back') {
    return (
      <button
        onClick={handleSubmitForApproval}
        disabled={submitting}
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200 transition-colors"
        title="Work was sent back for revision. Review changes and re-submit."
      >
        <RotateCcw className="w-3 h-3" />
        {submitting ? 'Re-submitting...' : 'Re-submit for Approval'}
      </button>
    );
  }

  // ── Active approval in progress ──────────────────────────────────────────

  if (currentStatus === 'in_approval' || workflowStatus === 'pending_approval') {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3" />
        In Approval
      </span>
    );
  }

  // ── Ready to submit ──────────────────────────────────────────────────────

  if (currentStatus === 'ready_for_approval') {
    return (
      <button
        onClick={handleSubmitForApproval}
        disabled={submitting}
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
      >
        <Send className="w-3 h-3" />
        {submitting ? 'Submitting...' : 'Submit for Approval'}
      </button>
    );
  }

  // ── Draft / default ──────────────────────────────────────────────────────

  return (
    <button
      onClick={handleMarkReady}
      disabled={submitting}
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition-colors"
    >
      <AlertCircle className="w-3 h-3" />
      {submitting ? 'Marking...' : 'Mark as Ready'}
    </button>
  );
};

export default EstimateApprovalActions;
