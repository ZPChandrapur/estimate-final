import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, CheckCircle, Clock, XCircle, AlertCircle, ThumbsUp, CornerUpLeft } from 'lucide-react';

interface BillProgressChartProps {
  billId: string;
  onBack: () => void;
}

interface BillDetails {
  id: string;
  bill_number: string;
  no_of_mb_entries: number;
  current_bill_amount: number;
  wdmm_amount: number;
  approval_status: string;
}

interface ApprovalStage {
  id: string;
  approval_level: number;
  approver_role: string;
  status: string;
  action_date: string | null;
  comments: string | null;
}

interface ApprovalHistory {
  id: string;
  status_name: string;
  action_date: string;
  action_type: string;
  days_taken: number;
  amount: number | null;
  percentage_check: number | null;
  no_of_entries: number | null;
}

const BillProgressChart: React.FC<BillProgressChartProps> = ({ billId, onBack }) => {
  const { user } = useAuth();
  const [billDetails, setBillDetails] = useState<BillDetails | null>(null);
  const [approvalStages, setApprovalStages] = useState<ApprovalStage[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'send_back' | 'reject'>('approve');
  const [approvalComments, setApprovalComments] = useState('');

  useEffect(() => {
    fetchBillData();
    fetchUserRoles();
  }, [billId]);

  const fetchUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role_id, roles(name)')
        .eq('user_id', user?.id);

      if (error) throw error;
      const roles = data?.map((ur: any) => ur.roles?.name).filter(Boolean) || [];
      setUserRoles(roles);
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  };

  const fetchBillData = async () => {
    try {
      setLoading(true);

      const [billResponse, stagesResponse, historyResponse] = await Promise.all([
        supabase
          .schema('estimate')
          .from('mb_bills')
          .select('*')
          .eq('id', billId)
          .single(),
        supabase
          .schema('estimate')
          .from('mb_bill_approvals')
          .select('*')
          .eq('bill_id', billId)
          .order('approval_level'),
        supabase
          .schema('estimate')
          .from('mb_bill_approval_history')
          .select('*')
          .eq('bill_id', billId)
          .order('action_date', { ascending: false })
      ]);

      if (billResponse.error) throw billResponse.error;
      if (stagesResponse.error) throw stagesResponse.error;
      if (historyResponse.error) throw historyResponse.error;

      setBillDetails(billResponse.data);
      setApprovalStages(stagesResponse.data || []);
      setApprovalHistory(historyResponse.data || []);
    } catch (error) {
      console.error('Error fetching bill data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage: ApprovalStage) => {
    if (stage.status === 'approved') return 'bg-green-500 text-white';
    if (stage.status === 'rejected') return 'bg-red-500 text-white';
    if (stage.status === 'sent_back') return 'bg-orange-500 text-white';
    if (stage.status === 'pending' && stage.approval_level === (billDetails?.current_approval_level || 0) + 1) {
      return 'bg-blue-500 text-white';
    }
    return 'bg-gray-300 text-gray-600';
  };

  const getStatusIcon = (actionType: string) => {
    switch (actionType) {
      case 'submitted':
      case 'checked':
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'sent_back':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'corrected':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (actionType: string) => {
    switch (actionType) {
      case 'submitted':
      case 'checked':
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'sent_back':
        return 'bg-red-100 text-red-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'corrected':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canApproveAtCurrentLevel = () => {
    if (!billDetails) return false;

    const roleApprovalMap: { [key: string]: number } = {
      'Junior Engineer': 2,
      'Junior Engineer (JE)': 2,
      'Deputy Engineer': 3,
      'Auditor': 4,
      'JE(D)': 5,
      'Accountant': 6,
      'Account': 6,
      'DEE': 7,
      'Executive Engineer': 8,
      'admin': 999,
      'super_admin': 999,
      'developer': 999
    };

    const userLevel = Math.max(...userRoles.map(role => roleApprovalMap[role] || 0));
    const nextApprovalLevel = billDetails.current_approval_level + 1;

    return userLevel === nextApprovalLevel && billDetails.approval_status !== 'ee_approved';
  };

  const handleApprovalAction = async () => {
    if (!billDetails) return;

    try {
      const { data, error } = await supabase
        .schema('estimate')
        .rpc('process_bill_approval', {
          p_bill_id: billId,
          p_approval_level: billDetails.current_approval_level + 1,
          p_action: approvalAction,
          p_comments: approvalComments || null
        });

      if (error) throw error;

      if (data?.success) {
        alert('Action processed successfully');
        setShowApprovalModal(false);
        setApprovalComments('');
        fetchBillData();
      } else {
        alert('Error: ' + (data?.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error processing approval:', error);
      alert('Error processing approval: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!billDetails) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Bill not found</p>
      </div>
    );
  }

  const approvedStages = approvalStages.filter(s => s.status === 'approved');
  const totalAmount = billDetails.current_bill_amount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Bills
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
          RABill No: {billDetails.bill_number} Progress Chart
        </h2>

        <div className="flex items-center justify-between mb-8 overflow-x-auto">
          {approvalStages.map((stage, index) => (
            <React.Fragment key={stage.id}>
              <div className="flex flex-col items-center min-w-[120px]">
                <div
                  className={`px-6 py-3 rounded-full font-medium text-sm transition-all ${getStageColor(
                    stage
                  )}`}
                >
                  {stage.approver_role}
                </div>
              </div>
              {index < approvalStages.length - 1 && (
                <div className="flex-1 h-1 bg-gray-300 mx-2" />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              RABill No: {billDetails.bill_number} Current Status
            </h3>

            <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-300">
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 bg-blue-50">
                      No of Entries In MB
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 bg-white">
                      {billDetails.no_of_mb_entries}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 bg-blue-50">
                      Total Amount
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-blue-600 font-semibold bg-white">
                      ₹{totalAmount.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 bg-blue-50">
                      WDMM Amount
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 bg-white">
                      ₹{billDetails.wdmm_amount.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-gray-300 rounded-lg overflow-hidden mt-6">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 border-r border-gray-300">
                      No Of Entries Check
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 border-r border-gray-300">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">
                      % Check
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                      Accepted By Contractor
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                      {billDetails.no_of_mb_entries}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      ₹{totalAmount.toFixed(2)}
                    </td>
                  </tr>
                  {approvedStages.filter(s => s.approval_level > 1).map((stage) => (
                    <tr key={stage.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                        Measured and checked By {stage.approver_role}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                        {billDetails.no_of_mb_entries}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        ₹{totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {approvedStages.length > 0 && (
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                        Physically verified and checked By EE
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                        {billDetails.no_of_mb_entries}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        ₹{totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              RABill No: {billDetails.bill_number} Current e-MB Status Log
            </h3>

            <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 border-r border-gray-300">
                      MBStatusName
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 border-r border-gray-300">
                      Date
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">
                      Days
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {approvalHistory.map((history) => (
                    <tr key={history.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(history.action_type)}
                          <span>{history.status_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-900 border-r border-gray-200">
                        {new Date(history.action_date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-900">
                        {history.days_taken}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {approvalHistory.length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  No approval history available
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-gray-700">MB Submitted / Bill Passed</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-gray-700">MB Checked / MB Accepted</span>
              </div>
            </div>
            <div className="mt-2 flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span className="text-gray-700">MB Corrected</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-gray-700">MB Send Back</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700">
            {approvedStages.length === approvalStages.length
              ? 'All approvals completed'
              : `No Entries are remaining to be Checked (Current Stage: ${
                  approvalStages.find(s => s.status === 'pending')?.approver_role || 'N/A'
                })`}
          </p>
        </div>

        {canApproveAtCurrentLevel() && (
          <div className="mt-6 flex items-center justify-center space-x-4">
            <button
              onClick={() => {
                setApprovalAction('approve');
                setShowApprovalModal(true);
              }}
              className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <ThumbsUp className="w-5 h-5 mr-2" />
              Approve
            </button>
            <button
              onClick={() => {
                setApprovalAction('send_back');
                setShowApprovalModal(true);
              }}
              className="flex items-center px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <CornerUpLeft className="w-5 h-5 mr-2" />
              Send Back
            </button>
            <button
              onClick={() => {
                setApprovalAction('reject');
                setShowApprovalModal(true);
              }}
              className="flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <XCircle className="w-5 h-5 mr-2" />
              Reject
            </button>
          </div>
        )}
      </div>

      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {approvalAction === 'approve' && 'Approve Bill'}
                {approvalAction === 'send_back' && 'Send Back Bill'}
                {approvalAction === 'reject' && 'Reject Bill'}
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comments {approvalAction !== 'approve' && '(Required)'}
                </label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your comments..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setApprovalComments('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprovalAction}
                  disabled={approvalAction !== 'approve' && !approvalComments.trim()}
                  className={`px-4 py-2 rounded-md text-white ${
                    approvalAction === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : approvalAction === 'send_back'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-red-600 hover:bg-red-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillProgressChart;
