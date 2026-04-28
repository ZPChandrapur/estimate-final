import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useRefreshOnVisibility } from '../hooks/useRefreshOnVisibility';
import { useYear } from '../contexts/YearContext';
import LoadingSpinner from './common/LoadingSpinner';
import EstimateApprovalActions from './EstimateApprovalActions';
import { CheckCircle, XCircle, RotateCcw, Send, Clock, FileCheck, MessageSquare, ChevronDown, ChevronUp, ArrowRight, Search } from 'lucide-react';

interface WorkRow {
  works_id: string;
  work_name: string;
  division: string;
  year: string | null;
  type: string;
  estimate_status: string;
  workflow?: WorkflowData;
}

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

const APPROVAL_LEVELS = [
  { level: 1, short: 'JE', label: 'Junior Engineer' },
  { level: 2, short: 'SDE', label: 'Sub Division Engineer' },
  { level: 3, short: 'DE', label: 'Divisional Engineer' },
  { level: 4, short: 'EE', label: 'Executive Engineer' },
];

const ApprovalFlowPipeline: React.FC<{ currentLevel: number; status: string }> = ({ currentLevel, status }) => {
  return (
    <div className="flex items-center space-x-1 flex-wrap gap-y-1">
      {APPROVAL_LEVELS.map((lvl, idx) => {
        const isPast = status === 'approved' ? true : lvl.level < currentLevel;
        const isCurrent = lvl.level === currentLevel;
        const isRejected = isCurrent && (status === 'rejected' || status === 'sent_back');
        const isFinalApproved = status === 'approved';

        let nodeClass = 'px-2 py-1 rounded-full text-xs font-semibold border ';
        if (isFinalApproved) {
          nodeClass += 'bg-green-100 text-green-700 border-green-300';
        } else if (isPast) {
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
            <span className={nodeClass} title={lvl.label}>
              {lvl.short}
            </span>
            {idx < APPROVAL_LEVELS.length - 1 && (
              <ArrowRight className={`w-3 h-3 flex-shrink-0 ${(isFinalApproved || isPast) ? 'text-green-400' : 'text-gray-300'}`} />
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
  const [works, setWorks] = useState<WorkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowData | null>(null);
  const [selectedWorkName, setSelectedWorkName] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionForm, setActionForm] = useState({ action: '', comments: '' });
  const [expandedHistory, setExpandedHistory] = useState<{ [key: string]: boolean }>({});
  const [hasFullAccess, setHasFullAccess] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useRefreshOnVisibility(
    async () => {
      try { await supabase.auth.refreshSession(); } catch (_) {}
      await fetchData(true);
    },
    [user]
  );

  const fetchData = async (background = false) => {
    if (!user) return;
    try {
      if (!background) setLoading(true);

      const [worksRes, workflowsRes, roleRes] = await Promise.all([
        supabase.schema('estimate').from('works')
          .select('works_id, work_name, division, year, type, estimate_status')
          .order('sr_no', { ascending: false }),
        supabase.schema('estimate').from('approval_workflows').select('*'),
        supabase.schema('public').from('user_roles').select('role_id, roles(name)').eq('user_id', user.id).maybeSingle(),
      ]);

      const allWorks = worksRes.data || [];
      const allWorkflows = workflowsRes.data || [];

      // latest workflow per work
      const latestByWork: Record<string, WorkflowData> = {};
      allWorkflows.forEach(wf => {
        const existing = latestByWork[wf.work_id];
        if (!existing || new Date(wf.initiated_at) > new Date(existing.initiated_at)) {
          latestByWork[wf.work_id] = wf;
        }
      });

      const enriched: WorkRow[] = allWorks.map(w => ({
        ...w,
        workflow: latestByWork[w.works_id],
      }));

      setWorks(enriched);

      if (roleRes.data?.roles) {
        const name = Array.isArray(roleRes.data.roles) ? roleRes.data.roles[0]?.name : (roleRes.data.roles as any).name;
        setHasFullAccess(name === 'super_admin' || name === 'developer');
      }
    } catch (error) {
      console.error('Error fetching approvals data:', error);
    } finally {
      if (!background) setLoading(false);
    }
  };

  const fetchHistory = async (workflowId: string) => {
    try {
      const { data, error } = await supabase
        .schema('estimate').from('approval_history').select('*')
        .eq('workflow_id', workflowId).order('created_at', { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((data || []).map(h => h.approver_id))];
      const [userRolesRes, rolesRes] = await Promise.all([
        supabase.schema('public').from('user_roles').select('user_id, name, role_id').in('user_id', userIds),
        supabase.schema('public').from('roles').select('id, name').eq('application', 'estimate'),
      ]);

      const enriched = (data || []).map(h => ({
        ...h,
        approver_name: userRolesRes.data?.find(ur => ur.user_id === h.approver_id)?.name || 'Unknown',
        role_name: rolesRes.data?.find(r => r.id === h.approver_role_id)?.name || 'Unknown',
      }));
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
      fetchData();
    } catch (error: any) {
      alert('Failed to process action: ' + error.message);
    }
  };

  const toggleHistory = (workflowId: string) => {
    const next = !expandedHistory[workflowId];
    setExpandedHistory(prev => ({ ...prev, [workflowId]: next }));
    if (next) fetchHistory(workflowId);
  };

  const getWorkflowStatusBadge = (work: WorkRow) => {
    if (!work.workflow) {
      const s = work.estimate_status;
      if (s === 'draft') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Draft</span>;
      if (s === 'ready_for_approval') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Ready</span>;
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{s}</span>;
    }
    const configs: Record<string, { color: string; icon: React.ElementType; label: string }> = {
      pending_approval: { color: 'bg-amber-100 text-amber-700', icon: Clock, label: 'In Progress' },
      approved: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Rejected' },
      sent_back: { color: 'bg-orange-100 text-orange-700', icon: RotateCcw, label: 'Sent Back' },
    };
    const cfg = configs[work.workflow.status] || configs.pending_approval;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
        <Icon className="w-3 h-3 mr-1" />{cfg.label}
      </span>
    );
  };

  const getActionBadge = (action: string) => {
    const configs: Record<string, string> = {
      submitted: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      sent_back: 'bg-orange-100 text-orange-700',
      forwarded: 'bg-teal-100 text-teal-700',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${configs[action] || 'bg-gray-100 text-gray-700'}`}>
        {action}
      </span>
    );
  };

  const filtered = works.filter(w => {
    const matchesYear = selectedYear === 'all' || w.year === selectedYear;
    const matchesSearch = !searchTerm ||
      w.work_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.works_id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesYear && matchesSearch;
  });

  if (loading) return <LoadingSpinner text="Loading approvals..." />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center space-x-4">
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
            <FileCheck className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">Approval Dashboard</h1>
            <p className="text-blue-100 text-sm mt-0.5">Track and manage estimate approvals across all works</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by work name or ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <span className="text-sm text-gray-500">{filtered.length} works</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-teal-600 to-blue-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Works ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Work Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Year</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Approval Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Pipeline</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Approval Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">History</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <FileCheck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                      <p className="text-gray-500 text-sm">No works found</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(work => (
                    <React.Fragment key={work.works_id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-semibold text-teal-700">{work.works_id}</span>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <span className="text-sm font-medium text-gray-900 line-clamp-2">{work.work_name}</span>
                          <span className="text-xs text-gray-500 block">{work.division}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${work.type === 'Technical Approval' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {work.type === 'Technical Approval' ? 'TA' : 'TS'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {work.year || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getWorkflowStatusBadge(work)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {work.workflow ? (
                            <ApprovalFlowPipeline
                              currentLevel={work.workflow.current_level}
                              status={work.workflow.status}
                            />
                          ) : (
                            <span className="text-xs text-gray-400 italic">Not submitted</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <EstimateApprovalActions
                              workId={work.works_id}
                              currentStatus={work.estimate_status}
                              onStatusUpdate={() => fetchData(true)}
                            />
                            {work.workflow && work.workflow.status === 'pending_approval' && (hasFullAccess || work.workflow.current_approver_id === user?.id) && (
                              <button
                                onClick={() => {
                                  setSelectedWorkflow(work.workflow!);
                                  setSelectedWorkName(work.work_name);
                                  setShowActionModal(true);
                                }}
                                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-green-600 to-teal-600 rounded-lg hover:from-green-700 hover:to-teal-700 transition-all shadow-sm"
                              >
                                Take Action
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {work.workflow ? (
                            <button
                              onClick={() => toggleHistory(work.workflow!.id)}
                              className="inline-flex items-center text-xs text-gray-600 hover:text-teal-600 transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5 mr-1" />
                              {expandedHistory[work.workflow.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded history row */}
                      {work.workflow && expandedHistory[work.workflow.id] && (
                        <tr key={`hist-${work.works_id}`}>
                          <td colSpan={8} className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Approval History — {work.work_name}</p>
                            {history.length > 0 ? (
                              <div className="space-y-2">
                                {history.map(entry => (
                                  <div key={entry.id} className="flex items-start justify-between bg-white rounded-lg p-3 border border-gray-200 text-xs">
                                    <div className="flex items-start gap-2">
                                      {getActionBadge(entry.action)}
                                      <div>
                                        <span className="font-medium text-gray-800">{entry.approver_name}</span>
                                        <span className="text-gray-500 ml-1">({entry.role_name})</span>
                                        {entry.comments && <p className="text-gray-600 mt-0.5">{entry.comments}</p>}
                                      </div>
                                    </div>
                                    <span className="text-gray-400 whitespace-nowrap ml-4">{new Date(entry.created_at).toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500">No history available</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Action Modal */}
      {showActionModal && selectedWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Take Approval Action</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedWorkName}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                <select
                  value={actionForm.action}
                  onChange={e => setActionForm({ ...actionForm, action: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select Action...</option>
                  <option value="approved">Approve & Forward</option>
                  {(hasFullAccess || selectedWorkflow.current_level === 4) && (
                    <option value="approved_final">Final Approve</option>
                  )}
                  <option value="rejected">Reject</option>
                  <option value="sent_back">Send Back for Changes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Comments (optional)</label>
                <textarea
                  value={actionForm.comments}
                  onChange={e => setActionForm({ ...actionForm, comments: e.target.value })}
                  rows={3}
                  placeholder="Add any comments or reasons..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowActionModal(false); setActionForm({ action: '', comments: '' }); }}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-green-700 hover:to-teal-700 transition-all shadow-md"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalDashboard;
