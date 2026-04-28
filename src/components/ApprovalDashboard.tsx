import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useRefreshOnVisibility } from '../hooks/useRefreshOnVisibility';
import { useYear } from '../contexts/YearContext';
import LoadingSpinner from './common/LoadingSpinner';
import EstimateApprovalActions from './EstimateApprovalActions';
import { CheckCircle, XCircle, RotateCcw, Send, Clock, FileCheck, MessageSquare, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

interface Workflow {
  id: string;
  work_id: string;
  current_level: number;
  current_approver_id: string;
  status: string;
  initiated_by: string;
  initiated_at: string;
  work_name?: string;
  work_division?: string;
  work_year?: string | null;
  estimate_status?: string;
  initiator_name?: string;
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

const APPROVAL_LEVELS = [
  { level: 1, short: 'JE', label: 'Junior Engineer' },
  { level: 2, short: 'SDE', label: 'Sub Division Engineer' },
  { level: 3, short: 'DE', label: 'Divisional Engineer' },
  { level: 4, short: 'EE', label: 'Executive Engineer' },
];

const ApprovalFlowPipeline: React.FC<{ currentLevel: number; status: string }> = ({ currentLevel, status }) => {
  return (
    <div className="flex items-center space-x-1 mt-3 flex-wrap gap-y-2">
      {APPROVAL_LEVELS.map((lvl, idx) => {
        const isPast = lvl.level < currentLevel;
        const isCurrent = lvl.level === currentLevel;
        const isFuture = lvl.level > currentLevel;
        const isRejected = isCurrent && (status === 'rejected' || status === 'sent_back');
        const isFinalApproved = status === 'approved' && isPast;

        let nodeClass = 'px-3 py-1.5 rounded-full text-xs font-semibold border ';
        if (isFinalApproved || isPast) {
          nodeClass += 'bg-green-100 text-green-700 border-green-300';
        } else if (isRejected) {
          nodeClass += 'bg-red-100 text-red-700 border-red-300';
        } else if (isCurrent) {
          nodeClass += 'bg-amber-100 text-amber-700 border-amber-400 ring-2 ring-amber-300';
        } else {
          nodeClass += 'bg-gray-100 text-gray-400 border-gray-200';
        }

        return (
          <React.Fragment key={lvl.level}>
            <div className="flex flex-col items-center">
              <span className={nodeClass} title={lvl.label}>
                {lvl.short}
              </span>
              {isCurrent && status === 'pending_approval' && (
                <span className="text-xs text-amber-600 mt-0.5 font-medium">Pending</span>
              )}
              {(isPast || isFinalApproved) && (
                <span className="text-xs text-green-600 mt-0.5">Done</span>
              )}
            </div>
            {idx < APPROVAL_LEVELS.length - 1 && (
              <ArrowRight className={`w-4 h-4 flex-shrink-0 ${isPast ? 'text-green-400' : 'text-gray-300'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const ApprovalDashboard: React.FC = () => {
  const { user } = useAuth();
  const { selectedYear } = useYear();
  const [pendingApprovals, setPendingApprovals] = useState<Workflow[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionForm, setActionForm] = useState({
    action: '',
    comments: '',
  });
  const [expandedHistory, setExpandedHistory] = useState<{ [key: string]: boolean }>({});
  const [hasFullAccess, setHasFullAccess] = useState(false);

  useEffect(() => {
    fetchApprovals();
    checkPermissions();
  }, [user]);

  // ✅ NEW: Refetch approvals when page becomes visible (background)
  useRefreshOnVisibility(
    async () => {
      try {
        await supabase.auth.refreshSession();
      } catch (e) {
        console.warn('Session refresh failed on visibility (approvals):', e);
      }
      await fetchApprovals(true);
      await checkPermissions();
    },
    [user]
  );

  const checkPermissions = async () => {
    if (!user) return;

    const { data: userRole } = await supabase
      .schema('public')
      .from('user_roles')
      .select('role_id, roles(name)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (userRole && userRole.roles) {
      const roleName = Array.isArray(userRole.roles) ? userRole.roles[0]?.name : userRole.roles.name;
      setHasFullAccess(roleName === 'super_admin' || roleName === 'developer');
    }
  };

  const fetchApprovals = async (background = false) => {
    if (!user) return;

    try {
      if (!background) setLoading(true);

      // Fetch all workflows and all works in parallel
      const [workflowsRes, worksRes] = await Promise.all([
        supabase.schema('estimate').from('approval_workflows').select('*'),
        supabase.schema('estimate').from('works').select('works_id, work_name, division, year, estimate_status, type').order('sr_no', { ascending: false }),
      ]);

      const allWorkflows = workflowsRes.data || [];
      const allWorks = worksRes.data || [];

      // Build a map of workId -> latest workflow
      const workflowByWorkId: Record<string, typeof allWorkflows[0]> = {};
      allWorkflows.forEach(wf => {
        if (!workflowByWorkId[wf.work_id] || new Date(wf.initiated_at) > new Date(workflowByWorkId[wf.work_id].initiated_at)) {
          workflowByWorkId[wf.work_id] = wf;
        }
      });

      // Pending: workflows where current user is approver OR admin
      const { data: userRoleData } = await supabase
        .schema('public').from('user_roles').select('role_id, roles(name)').eq('user_id', user.id).maybeSingle();
      const isAdmin = userRoleData?.roles &&
        (Array.isArray(userRoleData.roles)
          ? ['super_admin', 'developer'].includes(userRoleData.roles[0]?.name)
          : ['super_admin', 'developer'].includes((userRoleData.roles as any).name));

      const pendingWorkflows = allWorkflows.filter(wf =>
        wf.status === 'pending_approval' && (isAdmin || wf.current_approver_id === user.id)
      );

      const enrichPending = pendingWorkflows.map(wf => {
        const work = allWorks.find(w => w.works_id === wf.work_id);
        return { ...wf, work_name: work?.work_name || 'Unknown', work_division: work?.division || 'N/A', work_year: work?.year || null, estimate_status: work?.estimate_status || 'draft' };
      });

      // My submissions: all works the user submitted (workflows initiated by this user)
      const myWorkflows = allWorkflows.filter(wf => wf.initiated_by === user.id);
      const enrichSubmissions = myWorkflows.map(wf => {
        const work = allWorks.find(w => w.works_id === wf.work_id);
        return { ...wf, work_name: work?.work_name || 'Unknown', work_division: work?.division || 'N/A', work_year: work?.year || null, estimate_status: work?.estimate_status || 'draft' };
      });

      setPendingApprovals(enrichPending);
      setMySubmissions(enrichSubmissions);
    } catch (error) {
      console.error('Error fetching approvals:', error);
    } finally {
      if (!background) setLoading(false);
    }
  };

  const fetchHistory = async (workflowId: string) => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('approval_history')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const userIds = [...new Set(data?.map(h => h.approver_id) || [])];
      const { data: userRoles } = await supabase
        .schema('public')
        .from('user_roles')
        .select('user_id, name, role_id')
        .in('user_id', userIds);

      const { data: roles } = await supabase
        .schema('public')
        .from('roles')
        .select('id, name')
        .eq('application', 'estimate');

      const enriched = (data || []).map(h => {
        const userRole = userRoles?.find(ur => ur.user_id === h.approver_id);
        const role = roles?.find(r => r.id === h.approver_role_id);
        return {
          ...h,
          approver_name: userRole?.name || 'Unknown',
          role_name: role?.name || 'Unknown',
        };
      });

      setHistory(enriched);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleAction = async () => {
    if (!actionForm.action || !selectedWorkflow) {
      alert('Please select an action');
      return;
    }

    try {
      const { error } = await supabase.rpc('process_approval_action', {
        p_workflow_id: selectedWorkflow.id,
        p_action: actionForm.action,
        p_comments: actionForm.comments || null,
      });

      if (error) throw error;

      alert('Action completed successfully');
      setShowActionModal(false);
      setActionForm({ action: '', comments: '' });
      setSelectedWorkflow(null);
      fetchApprovals();
    } catch (error: any) {
      console.error('Error processing action:', error);
      alert('Failed to process action: ' + error.message);
    }
  };

  const canTakeAction = (workflow: Workflow) => {
    return hasFullAccess || workflow.current_approver_id === user?.id;
  };

  const getLevelName = (level: number) => {
    switch (level) {
      case 1: return 'Junior Engineer';
      case 2: return 'Sub Division Engineer';
      case 3: return 'Divisional Engineer';
      case 4: return 'Executive Engineer';
      default: return `Level ${level}`;
    }
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      pending_approval: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Pending' },
      approved: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Rejected' },
      sent_back: { color: 'bg-orange-100 text-orange-700', icon: RotateCcw, label: 'Sent Back' },
    };
    const config = configs[status as keyof typeof configs] || configs.pending_approval;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const getActionBadge = (action: string) => {
    const configs = {
      submitted: { color: 'bg-blue-100 text-blue-700', label: 'Submitted' },
      approved: { color: 'bg-green-100 text-green-700', label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-700', label: 'Rejected' },
      sent_back: { color: 'bg-orange-100 text-orange-700', label: 'Sent Back' },
      forwarded: { color: 'bg-purple-100 text-purple-700', label: 'Forwarded' },
    };
    const config = configs[action as keyof typeof configs] || { color: 'bg-gray-100 text-gray-700', label: action };
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const toggleHistory = (workflowId: string) => {
    if (expandedHistory[workflowId]) {
      setExpandedHistory({ ...expandedHistory, [workflowId]: false });
    } else {
      setExpandedHistory({ ...expandedHistory, [workflowId]: true });
      fetchHistory(workflowId);
    }
  };

  const filteredPending = selectedYear === 'all'
    ? pendingApprovals
    : pendingApprovals.filter(w => w.work_year === selectedYear);
  const filteredSubmissions = selectedYear === 'all'
    ? mySubmissions
    : mySubmissions.filter(w => w.work_year === selectedYear);

  if (loading) {
    return <LoadingSpinner text="Loading approvals..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
              <FileCheck className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">Approval Dashboard</h1>
              <p className="text-blue-100 text-base mt-1 drop-shadow">
                Manage estimate approvals and track submissions
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-orange-50">
            <h2 className="font-semibold text-gray-900 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-yellow-600" />
              Pending Approvals ({filteredPending.length})
            </h2>
          </div>
          <div className="p-6">
            {filteredPending.length > 0 ? (
              <div className="space-y-4">
                {filteredPending.map(workflow => (
                  <div key={workflow.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{workflow.work_name}</h3>
                          <p className="text-sm text-gray-600 mt-1">Work ID: {workflow.work_id}</p>
                          <p className="text-sm text-gray-600">Division: {workflow.work_division}</p>
                          <ApprovalFlowPipeline currentLevel={workflow.current_level} status={workflow.status} />
                          <p className="text-xs text-gray-500 mt-2">
                            Submitted: {new Date(workflow.initiated_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          {getStatusBadge(workflow.status)}
                          <EstimateApprovalActions
                            workId={workflow.work_id}
                            currentStatus={workflow.estimate_status || 'draft'}
                            onStatusUpdate={() => fetchApprovals(true)}
                          />
                          {canTakeAction(workflow) ? (
                            <button
                              onClick={() => {
                                setSelectedWorkflow(workflow);
                                setShowActionModal(true);
                              }}
                              className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all duration-200 shadow-md text-sm"
                            >
                              Take Action
                            </button>
                          ) : (
                            <span className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm cursor-not-allowed">
                              No Permission
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-gray-200">
                      <button
                        onClick={() => toggleHistory(workflow.id)}
                        className="w-full px-4 py-2 bg-white hover:bg-gray-50 flex items-center justify-between text-sm text-gray-700"
                      >
                        <span className="flex items-center">
                          <MessageSquare className="w-4 h-4 mr-2" />
                          View History
                        </span>
                        {expandedHistory[workflow.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {expandedHistory[workflow.id] && (
                        <div className="p-4 bg-gray-50 border-t border-gray-200">
                          {history.length > 0 ? (
                            <div className="space-y-3">
                              {history.map(entry => (
                                <div key={entry.id} className="bg-white p-3 rounded border border-gray-200">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="flex items-center space-x-2">
                                        {getActionBadge(entry.action)}
                                        <span className="text-sm font-medium text-gray-900">{entry.approver_name}</span>
                                        <span className="text-xs text-gray-500">({entry.role_name})</span>
                                      </div>
                                      {entry.comments && (
                                        <p className="text-sm text-gray-600 mt-2">{entry.comments}</p>
                                      )}
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {new Date(entry.created_at).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 text-center py-2">No history available</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Clock className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No pending approvals</h3>
                <p className="text-gray-500">You don't have any estimates waiting for your approval.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="font-semibold text-gray-900 flex items-center">
              <Send className="w-5 h-5 mr-2 text-blue-600" />
              My Submissions ({filteredSubmissions.length})
            </h2>
          </div>
          <div className="p-6">
            {filteredSubmissions.length > 0 ? (
              <div className="space-y-4">
                {filteredSubmissions.map(workflow => (
                  <div key={workflow.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{workflow.work_name}</h3>
                        <p className="text-sm text-gray-600 mt-1">Work ID: {workflow.work_id}</p>
                        <p className="text-sm text-gray-600">Division: {workflow.work_division}</p>
                        <ApprovalFlowPipeline currentLevel={workflow.current_level} status={workflow.status} />
                        <p className="text-xs text-gray-500 mt-2">
                          Submitted: {new Date(workflow.initiated_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        {getStatusBadge(workflow.status)}
                        <EstimateApprovalActions
                          workId={workflow.work_id}
                          currentStatus={workflow.estimate_status || 'draft'}
                          onStatusUpdate={() => fetchApprovals(true)}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => toggleHistory(workflow.id)}
                      className="mt-3 w-full px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-between text-sm text-gray-700"
                    >
                      <span className="flex items-center">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        View History
                      </span>
                      {expandedHistory[workflow.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {expandedHistory[workflow.id] && (
                      <div className="mt-3 p-4 bg-white rounded border border-gray-200">
                        {history.length > 0 ? (
                          <div className="space-y-3">
                            {history.map(entry => (
                              <div key={entry.id} className="bg-gray-50 p-3 rounded border border-gray-200">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      {getActionBadge(entry.action)}
                                      <span className="text-sm font-medium text-gray-900">{entry.approver_name}</span>
                                      <span className="text-xs text-gray-500">({entry.role_name})</span>
                                    </div>
                                    {entry.comments && (
                                      <p className="text-sm text-gray-600 mt-2">{entry.comments}</p>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {new Date(entry.created_at).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 text-center py-2">No history available</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Send className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions yet</h3>
                <p className="text-gray-500">You haven't submitted any estimates for approval.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Take Approval Action</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                <select
                  value={actionForm.action}
                  onChange={e => setActionForm({ ...actionForm, action: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="">Select Action...</option>
                  <option value="approved">Approve & Forward</option>
                  {(hasFullAccess || selectedWorkflow?.current_level === 4) &&
                    <option value="approved_final">Final Approve</option>
                  }
                  <option value="rejected">Reject</option>
                  <option value="sent_back">Send Back for Changes</option>
                </select>
                {(hasFullAccess || selectedWorkflow?.current_level === 4) && (
                  <p className="mt-2 text-xs text-gray-500">
                    <strong>Approve & Forward:</strong> Send to next level.
                    <strong className="ml-2">Final Approve:</strong> Complete approval workflow.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Comments</label>
                <textarea
                  value={actionForm.comments}
                  onChange={e => setActionForm({ ...actionForm, comments: e.target.value })}
                  rows={4}
                  placeholder="Add any comments or reasons for this action..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={handleAction}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl font-semibold shadow-md hover:scale-[1.03] transition-transform duration-200"
              >
                Submit
              </button>
              <button
                onClick={() => {
                  setShowActionModal(false);
                  setActionForm({ action: '', comments: '' });
                }}
                className="px-6 py-3 bg-gray-300 text-gray-800 rounded-xl font-semibold shadow-sm hover:bg-gray-400 transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalDashboard;
