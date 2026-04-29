import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useRefreshOnVisibility } from '../hooks/useRefreshOnVisibility';
import { useYear } from '../contexts/YearContext';
import LoadingSpinner from './common/LoadingSpinner';
import EstimateApprovalActions from './EstimateApprovalActions';
import ApprovalActionWithSignature from './approval/ApprovalActionWithSignature';
import {
  CheckCircle, XCircle, RotateCcw, Clock, FileCheck,
  MessageSquare, ChevronDown, ChevronUp, Search, Filter,
  ArrowRight, User, X
} from 'lucide-react';

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

const LEVELS = [
  { level: 1, short: 'JE', label: 'Junior Engineer' },
  { level: 2, short: 'SDE', label: 'Sub Div. Engineer' },
  { level: 3, short: 'DE', label: 'Div. Engineer' },
  { level: 4, short: 'EE', label: 'Executive Engineer' },
];

const Pipeline: React.FC<{ currentLevel: number; status: string }> = ({ currentLevel, status }) => {
  const isFullyApproved = status === 'approved';
  return (
    <div className="flex items-center gap-1.5">
      {LEVELS.map((lvl, idx) => {
        const done = isFullyApproved || lvl.level < currentLevel;
        const active = !isFullyApproved && lvl.level === currentLevel;
        const rejected = active && (status === 'rejected' || status === 'sent_back');
        const future = !done && !active;

        let pill = 'inline-flex flex-col items-center';
        let badge = 'px-2.5 py-1 rounded-full text-[11px] font-bold border ';
        if (isFullyApproved || done) badge += 'bg-emerald-100 text-emerald-700 border-emerald-300';
        else if (rejected) badge += 'bg-red-100 text-red-700 border-red-300';
        else if (active) badge += 'bg-amber-100 text-amber-700 border-amber-400 ring-2 ring-amber-300 shadow-sm';
        else badge += 'bg-gray-100 text-gray-400 border-gray-200';

        return (
          <React.Fragment key={lvl.level}>
            <div className={pill}>
              <span className={badge} title={lvl.label}>{lvl.short}</span>
              <span className={`text-[9px] mt-0.5 font-medium ${done || isFullyApproved ? 'text-emerald-600' : active && !rejected ? 'text-amber-600' : rejected ? 'text-red-500' : 'text-gray-400'}`}>
                {done || isFullyApproved ? '✓' : active && !rejected ? 'Pending' : rejected ? status === 'rejected' ? 'Rejected' : 'Sent Back' : ''}
              </span>
            </div>
            {idx < LEVELS.length - 1 && (
              <ArrowRight className={`w-3 h-3 flex-shrink-0 mb-2 ${done || isFullyApproved ? 'text-emerald-400' : 'text-gray-300'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const StatusBadge: React.FC<{ work: WorkRow }> = ({ work }) => {
  if (!work.workflow) {
    if (work.estimate_status === 'draft') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">Draft</span>;
    if (work.estimate_status === 'ready_for_approval') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">Ready</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">{work.estimate_status}</span>;
  }
  const map: Record<string, { cls: string; icon: React.ElementType; label: string }> = {
    pending_approval: { cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock, label: 'In Progress' },
    approved: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle, label: 'Approved' },
    rejected: { cls: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, label: 'Rejected' },
    sent_back: { cls: 'bg-orange-100 text-orange-700 border-orange-200', icon: RotateCcw, label: 'Sent Back' },
  };
  const cfg = map[work.workflow.status] || map.pending_approval;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
};

const ApprovalDashboard: React.FC = () => {
  const { user } = useAuth();
  const { selectedYear } = useYear();
  const [works, setWorks] = useState<WorkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'TA' | 'TS'>('all');
  const [hasFullAccess, setHasFullAccess] = useState(false);

  // Action modal
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowData | null>(null);
  const [selectedWorkName, setSelectedWorkName] = useState('');
  const [selectedWorkId, setSelectedWorkId] = useState('');
  const [approverName, setApproverName] = useState('');
  const [actionForm, setActionForm] = useState({ action: '', comments: '' });
  const [useSignatureFlow, setUseSignatureFlow] = useState(true);

  // History panel (side drawer)
  const [historyWorkflow, setHistoryWorkflow] = useState<WorkflowData | null>(null);
  const [historyWorkName, setHistoryWorkName] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (user) fetchData();
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

      const allWorkflows = workflowsRes.data || [];
      const latestByWork: Record<string, WorkflowData> = {};
      allWorkflows.forEach(wf => {
        const ex = latestByWork[wf.work_id];
        if (!ex || new Date(wf.initiated_at) > new Date(ex.initiated_at)) latestByWork[wf.work_id] = wf;
      });

      const enriched: WorkRow[] = (worksRes.data || []).map(w => ({ ...w, workflow: latestByWork[w.works_id] }));
      setWorks(enriched);

      if (roleRes.data?.roles) {
        const name = Array.isArray(roleRes.data.roles) ? (roleRes.data.roles[0] as any)?.name : (roleRes.data.roles as any).name;
        setHasFullAccess(name === 'super_admin' || name === 'developer');
      }
    } catch (e) {
      console.error('Error fetching approvals:', e);
    } finally {
      if (!background) setLoading(false);
    }
  };

  const fetchHistory = async (wf: WorkflowData, workName: string) => {
    setHistoryWorkflow(wf);
    setHistoryWorkName(workName);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase.schema('estimate').from('approval_history').select('*')
        .eq('workflow_id', wf.id).order('created_at', { ascending: true });
      if (error) throw error;
      const userIds = [...new Set((data || []).map(h => h.approver_id))];
      const [urRes, rolesRes] = await Promise.all([
        supabase.schema('public').from('user_roles').select('user_id, name, role_id').in('user_id', userIds),
        supabase.schema('public').from('roles').select('id, name').eq('application', 'estimate'),
      ]);
      setHistory((data || []).map(h => ({
        ...h,
        approver_name: urRes.data?.find(u => u.user_id === h.approver_id)?.name || 'Unknown',
        role_name: rolesRes.data?.find(r => r.id === h.approver_role_id)?.name || 'Unknown',
      })));
    } catch (e) {
      console.error('Error fetching history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAction = async () => {
    if (!actionForm.action || !selectedWorkflow) { alert('Please select an action'); return; }
    try {
      const { error } = await supabase.rpc('process_approval_action', {
        p_workflow_id: selectedWorkflow.id,
        p_action: actionForm.action,
        p_comments: actionForm.comments || null,
      });
      if (error) throw error;
      alert('Action completed successfully');
      setSelectedWorkflow(null);
      setActionForm({ action: '', comments: '' });
      fetchData();
    } catch (error: any) {
      alert('Failed to process action: ' + error.message);
    }
  };

  // Fetch approver name and open workflow with signature flow
  const openWorkflowWithSignature = async (workflow: WorkflowData, workName: string, workId: string) => {
    try {
      setSelectedWorkflow(workflow);
      setSelectedWorkName(workName);
      setSelectedWorkId(workId);
      
      // Fetch approver name
      const { data, error } = await supabase
        .schema('public')
        .from('user_roles')
        .select('name')
        .eq('user_id', workflow.current_approver_id)
        .single();
      
      if (error) {
        console.warn('Could not fetch approver name:', error);
        setApproverName('Approver');
      } else {
        setApproverName(data?.name || 'Approver');
      }
      
      setUseSignatureFlow(true);
    } catch (err) {
      console.error('Error opening workflow:', err);
      setApproverName('Approver');
    }
  };

  const pendingCount = works.filter(w =>
    w.workflow?.status === 'pending_approval' && (hasFullAccess || w.workflow.current_approver_id === user?.id)
  ).length;

  const filtered = works.filter(w => {
    const matchesYear = selectedYear === 'all' || w.year === selectedYear;
    const matchesSearch = !searchTerm ||
      w.work_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.works_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' ||
      (typeFilter === 'TA' && w.type === 'Technical Approval') ||
      (typeFilter === 'TS' && w.type === 'Technical Sanction');
    const matchesTab = activeTab === 'all' ||
      (w.workflow?.status === 'pending_approval' && (hasFullAccess || w.workflow.current_approver_id === user?.id));
    return matchesYear && matchesSearch && matchesType && matchesTab;
  });

  const actionBadgeClass: Record<string, string> = {
    submitted: 'bg-blue-50 text-blue-700 border-blue-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    approved_final: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    sent_back: 'bg-orange-50 text-orange-700 border-orange-200',
    forwarded: 'bg-teal-50 text-teal-700 border-teal-200',
  };

  if (loading) return <LoadingSpinner text="Loading approvals..." />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-blue-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-2xl shadow-lg">
            <FileCheck className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Approval Dashboard</h1>
            <p className="text-teal-100 text-sm mt-0.5">Track and manage estimate approvals for all works</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'all' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            All Works ({works.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'pending' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            <Clock className="w-4 h-4" />
            Pending for Me
            {pendingCount > 0 && (
              <span className={`min-w-[20px] h-5 rounded-full text-[11px] font-bold flex items-center justify-center px-1.5 ${activeTab === 'pending' ? 'bg-white text-amber-600' : 'bg-red-500 text-white'}`}>
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
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
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as 'all' | 'TA' | 'TS')}
              className="text-sm font-medium text-gray-700 bg-transparent border-none outline-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="TA">Technical Approval (TA)</option>
              <option value="TS">Technical Sanction (TS)</option>
            </select>
          </div>
          <span className="text-sm text-gray-500 ml-auto">{filtered.length} works</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-teal-700 to-blue-600">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Works ID</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Work Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Year</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Approval Pipeline</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Action</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-white uppercase tracking-wider">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <FileCheck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                      <p className="text-gray-400 text-sm font-medium">
                        {activeTab === 'pending' ? 'No approvals pending for you' : 'No works found'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((work, idx) => (
                    <tr key={work.works_id} className={`transition-colors hover:bg-teal-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      {/* Works ID */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-teal-700">{work.works_id}</span>
                      </td>

                      {/* Work Name */}
                      <td className="px-5 py-4 max-w-[260px]">
                        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{work.work_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{work.division}</p>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${work.type === 'Technical Approval' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                          {work.type === 'Technical Approval' ? 'TA' : 'TS'}
                        </span>
                      </td>

                      {/* Year */}
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                        {work.year || <span className="text-gray-300">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <StatusBadge work={work} />
                      </td>

                      {/* Pipeline */}
                      <td className="px-5 py-4">
                        {work.workflow ? (
                          <Pipeline currentLevel={work.workflow.current_level} status={work.workflow.status} />
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not submitted</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <EstimateApprovalActions
                            workId={work.works_id}
                            workType={work.type === 'Technical Sanction' ? 'TS' : 'TA'}
                            currentStatus={work.estimate_status}
                            onStatusUpdate={() => fetchData(true)}
                          />
                          {work.workflow?.status === 'pending_approval' &&
                            (hasFullAccess || work.workflow.current_approver_id === user?.id) && (
                            <button
                              onClick={() => openWorkflowWithSignature(work.workflow!, work.work_name, work.works_id)}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-teal-600 to-blue-600 rounded-lg hover:from-teal-700 hover:to-blue-700 transition-all shadow-sm"
                            >
                              Take Action
                            </button>
                          )}
                        </div>
                      </td>

                      {/* History */}
                      <td className="px-5 py-4 text-center">
                        {work.workflow ? (
                          <button
                            onClick={() => fetchHistory(work.workflow!, work.work_name)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-800 transition-colors px-2 py-1 rounded-lg hover:bg-teal-50"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            View
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Action Modal with Digital Signature ── */}
      {selectedWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white z-10">
              <div>
                <h2 className="text-base font-bold text-gray-900">Take Approval Action</h2>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{selectedWorkName}</p>
              </div>
              <button 
                onClick={() => {
                  setSelectedWorkflow(null);
                  setActionForm({ action: '', comments: '' });
                  setApproverName('');
                }} 
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            
            {/* Use ApprovalActionWithSignature for signature-based approval */}
            {useSignatureFlow && selectedWorkflow && (
              <div className="p-6">
                <ApprovalActionWithSignature
                  workflowId={selectedWorkflow.id}
                  approvalLevel={selectedWorkflow.current_level}
                  currentApproverId={selectedWorkflow.current_approver_id}
                  approverName={approverName}
                  workId={selectedWorkId}
                  onApprovalComplete={() => {
                    setSelectedWorkflow(null);
                    setActionForm({ action: '', comments: '' });
                    setApproverName('');
                    fetchData(true);
                  }}
                />
              </div>
            )}
            
            {/* Fallback to basic form if signature flow is disabled */}
            {!useSignatureFlow && (
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Current Stage</label>
                  <Pipeline currentLevel={selectedWorkflow.current_level} status={selectedWorkflow.status} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Action *</label>
                  <select
                    value={actionForm.action}
                    onChange={e => setActionForm({ ...actionForm, action: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Choose an action...</option>
                    <option value="approved">Approve & Forward to Next Level</option>
                    {(hasFullAccess || selectedWorkflow.current_level === 4) && (
                      <option value="approved_final">Final Approve (Complete Workflow)</option>
                    )}
                    <option value="rejected">Reject</option>
                    <option value="sent_back">Send Back for Revision</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Comments</label>
                  <textarea
                    value={actionForm.comments}
                    onChange={e => setActionForm({ ...actionForm, comments: e.target.value })}
                    rows={3}
                    placeholder="Add remarks or reasons (optional)..."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </div>
              </div>
            )}
            
            {!useSignatureFlow && (
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={() => { 
                    setSelectedWorkflow(null);
                    setActionForm({ action: '', comments: '' });
                    setApproverName('');
                  }}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={!actionForm.action}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-teal-600 to-blue-600 rounded-xl hover:from-teal-700 hover:to-blue-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Action
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── History Side Panel ── */}
      {historyWorkflow && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setHistoryWorkflow(null)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col">
            {/* Panel Header */}
            <div className="bg-gradient-to-r from-teal-700 to-blue-600 px-6 py-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Approval History</h2>
                <p className="text-teal-100 text-xs mt-0.5 line-clamp-2">{historyWorkName}</p>
              </div>
              <button onClick={() => setHistoryWorkflow(null)} className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors mt-0.5">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Pipeline in panel */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Approval Flow</p>
              <Pipeline currentLevel={historyWorkflow.current_level} status={historyWorkflow.status} />
            </div>

            {/* History entries */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry, idx) => (
                    <div key={entry.id} className="relative pl-8">
                      {/* Timeline line */}
                      {idx < history.length - 1 && (
                        <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-gray-200" />
                      )}
                      {/* Dot */}
                      <div className="absolute left-1.5 top-2 w-3 h-3 rounded-full border-2 border-teal-500 bg-white" />

                      <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${actionBadgeClass[entry.action] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                {entry.action === 'approved_final' ? 'Final Approved' : entry.action.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </span>
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <User className="w-3 h-3" />
                                <span className="font-semibold">{entry.approver_name}</span>
                                <span className="text-gray-400">· {entry.role_name}</span>
                              </div>
                            </div>
                            {entry.comments && (
                              <p className="text-xs text-gray-600 mt-1.5 bg-white rounded-lg px-3 py-2 border border-gray-200 italic">
                                "{entry.comments}"
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">
                            {new Date(entry.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                            <br />
                            {new Date(entry.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalDashboard;
