import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, CheckCircle } from 'lucide-react';

interface EstimateApprovalActionsProps {
  workId: string;
  currentStatus: string;
  onStatusUpdate: () => void;
}

const EstimateApprovalActions: React.FC<EstimateApprovalActionsProps> = ({ workId, currentStatus, onStatusUpdate }) => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [hasWorkflow, setHasWorkflow] = useState(false);

  useEffect(() => {
    checkWorkflow();
  }, [workId]);

  const checkWorkflow = async () => {
    try {
      const { data } = await supabase
        .schema('estimate')
        .from('approval_workflows')
        .select('id')
        .eq('work_id', workId)
        .maybeSingle();

      setHasWorkflow(!!data);
    } catch (error) {
      console.error('Error checking workflow:', error);
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

      alert('Estimate marked as ready for approval');
      onStatusUpdate();
    } catch (error: any) {
      console.error('Error marking ready:', error);
      alert('Failed to mark as ready: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!confirm('Are you sure you want to submit this estimate for approval? Once submitted, only the assigned approver can make changes.')) {
      return;
    }

    try {
      setSubmitting(true);

      const { data, error } = await supabase
        .schema('estimate')
        .rpc('initiate_approval_workflow', {
          p_work_id: workId,
        });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      alert('Estimate submitted for approval successfully');
      onStatusUpdate();
      checkWorkflow();
    } catch (error: any) {
      console.error('Error submitting for approval:', error);

      let errorMessage = 'Failed to submit for approval: ';
      if (error.message) {
        errorMessage += error.message;
      } else if (error.hint) {
        errorMessage += error.hint;
      } else {
        errorMessage += JSON.stringify(error);
      }

      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (currentStatus === 'approved') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle className="w-3 h-3 mr-1" />
        Approved
      </span>
    );
  }

  if (currentStatus === 'in_approval' || hasWorkflow) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <Send className="w-3 h-3 mr-1" />
        In Approval
      </span>
    );
  }

  if (currentStatus === 'ready_for_approval') {
    return (
      <button
        onClick={handleSubmitForApproval}
        disabled={submitting}
        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
      >
        <Send className="w-3 h-3 mr-1" />
        {submitting ? 'Submitting...' : 'Submit for Approval'}
      </button>
    );
  }

  return (
    <button
      onClick={handleMarkReady}
      disabled={submitting}
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
    >
      <CheckCircle className="w-3 h-3 mr-1" />
      {submitting ? 'Marking...' : 'Mark as Ready'}
    </button>
  );
};

export default EstimateApprovalActions;
