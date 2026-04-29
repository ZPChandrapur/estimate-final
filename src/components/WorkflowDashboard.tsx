import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useRefreshOnVisibility } from '../hooks/useRefreshOnVisibility';
import { useYear } from '../contexts/YearContext';
import LoadingSpinner from './common/LoadingSpinner';
import EstimateApprovalActions from './EstimateApprovalActions';
import {
  CheckCircle, XCircle, RotateCcw, Clock, GitBranch,
  MessageSquare, Search, ArrowRight, User, X, AlertTriangle
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
  work_id: string;
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
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';
  const isSentBack = status === 'sent_back';

  return (
    <div className="flex items-center gap-1">
      {LEVELS.map((lvl, idx) => {
        const passed = isApproved || lvl.level < currentLevel;
        const active = !isApproved && lvl.level === currentLevel;

        let badge = 'px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all ';
        if (isApproved || passed) {
          badge += 'bg-emerald-100 text-emerald-700 border-emerald-300';
        } else if (active && isRejected) {
          badge += 'bg-red-100 text-red-700 border-red-300 ring-2 ring-red-200';
        } else if (active && isSentBack) {
          badge += 'bg-orange-100 text-orange-700 border-orange-300 ring-2 ring-orange-200';
        } else if (active) {
          badge += 'bg-amber-100 text-amber-700 border-amber-400 ring-2 ring-amber-300';
        } else {
          badge += 'bg-gray-100 text-gray-400 border-gray-200';
        }

        return (
          <React.Fragment key={lvl.level}>
            <span className={badge} title={lvl.label}>{lvl.short}</span>
            {idx < LEVELS.length - 1 && (
              <ArrowRight className={`w-3 h-3 flex-shrink-0 ${(isApproved || passed) ? 'text-emerald-400' : 'text-gray-300'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Derive the effective display status from both work and workflow
function getEffectiveStatus(work: WorkRow): string {
  if (work.workflow) return work.workflow.status;
  return work.estimate_status;
}

const STATUS_CONFIG: Record<string, { cls: string; icon: React.ElementType; label: string }> = {
  draft:              { cls: 'bg-gray-100 text-gray-500 border-gray-200',    icon: Clock,         label: 'Draft' },
  ready_for_approval: { cls: 'bg-blue-100 text-blue-700 border-blue-200',    icon: Clock,         label: 'Ready' },
  in_approval:        { cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock,         label: 'In Approval' },
  pending_approval:   { cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock,         label: 'In Progress' },
  approved:           { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle, label: 'Approved' },
  rejected:           { cls: 'bg-red-100 text-red-700 border-red-200',       icon: XCircle,       label: 'Rejected' },
  sent_back:          { cls: 'bg-orange-100 text-orange-700 border-orange-200', icon: RotateCcw,   label: 'Sent Back' },
};

const WfStatusBadge: React.FC<{ work: WorkRow }> = ({ work }) => {
  const status = getEffectiveStatus(work);
  const cfg = STATUS_CONFIG[status] ?? { cls: 'bg-gray-100 text-gray-500 border-gray-200', icon: AlertTriangle, label: status };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
};

const WorkflowDashboard: React.FC = () => {
  const { user } = useAuth();
  const { selectedYear } = useYear();
  const [works, setWorks] = useState<WorkRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'ta' | 'ts' | 'pending'>('ta');
  const [searchTerm, setSearchTerm] = useState('');
  const [hasFullAccess, setHasFullAccess] = useState(false);

  // Action modal
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowData | null>(null);
  const [selectedWorkName, setSelectedWorkName] = useState('');
  const [actionForm, setActionForm] = useState({ action: '', comments: '' });
  const [submittingAction, setSubmittingAction] = useState(false);

  // History side panel — shows ALL history for a work across all workflow runs
  const [historyWorkId, setHistoryWorkId] = useState<string | null>(null);
  const [historyWorkName, setHistoryWorkName] = useState('');
  const [historyWorkflow, setHistoryWorkflow] = useState<WorkflowData | null>(null);
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
      // Keep the most recent workflow per work
      const latestByWork: Record<string, WorkflowData> = {};
      allWorkflows.forEach(wf => {
        const ex = latestByWork[wf.work_id];
        if (!ex || new Date(wf.initiated_at) > new Date(ex.initiated_at)) latestByWork[wf.work_id] = wf;
      });

      const enriched: WorkRow[] = (worksRes.data || []).map(w => ({ ...w, workflow: latestByWork[w.works_id] }));
      setWorks(enriched);

      if (roleRes.data?.roles) {
        const name = Array.isArray(roleRes.data.roles)
          ? (roleRes.data.roles[0] as any)?.name
          : (roleRes.data.roles as any).name;
        setHasFullAccess(name === 'super_admin' || name === 'developer');
      }
    } catch (e) {
      console.error('Error fetching workflow data:', e);
    } finally {
      if (!background) setLoading(false);
    }
  };

  // Fetch ALL history across ALL workflow runs for a work
  const fetchHistory = async (work: WorkRow) => {
    setHistoryWorkId(work.works_id);
    setHistoryWorkName(work.work_name);
    setHistoryWorkflow(work.workflow ?? null);
    setHistory([]);
    setHistoryLoading(true);
    try {
      // Get all workflow ids for this work
      const { data: wfRows } = await supabase
        .schema('estimate').from('approval_workflows')
        .select('id').eq('work_id', work.works_id);

      const wfIds = (wfRows || []).map(w => w.id);
      if (wfIds.length === 0) { setHistoryLoading(false); return; }

      const { data: histRows } = await supabase
        .schema('estimate').from('approval_history')
        .select('*')
        .in('workflow_id', wfIds)
        .order('created_at', { ascending: true });

      const userIds = [...new Set((histRows || []).map(h => h.approver_id))];
      const [urRes, rolesRes] = await Promise.all([
        supabase.schema('public').from('user_roles').select('user_id, name').in('user_id', userIds),
        supabase.schema('public').from('roles').select('id, name'),
      ]);

      setHistory((histRows || []).map(h => ({
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
      setSubmittingAction(true);
      const { error } = await supabase.schema('estimate').rpc('process_approval_action', {
        p_workflow_id: selectedWorkflow.id,
        p_action: actionForm.action,
        p_comments: actionForm.comments || null,
      });
      if (error) throw error;
      setSelectedWorkflow(null);
      setActionForm({ action: '', comments: '' });
      await fetchData();
    } catch (error: any) {
      alert('Failed to process action: ' + error.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const taWorks = works.filter(w => w.type === 'Technical Approval');
  const tsWorks = works.filter(w => w.type === 'Technical Sanction');
  const pendingWorks = works.filter(w =>
    w.workflow?.status === 'pending_approval' &&
    (hasFullAccess || w.workflow.current_approver_id === user?.id)
  );

  const countPending = (list: WorkRow[]) => list.filter(w =>
    w.workflow?.status === 'pending_approval' && (hasFullAccess || w.workflow.current_approver_id === user?.id)
  ).length;

  const baseRows = activeTab === 'ta' ? taWorks : activeTab === 'ts' ? tsWorks : pendingWorks;

  const filtered = baseRows.filter(w => {
    const matchesYear = selectedYear === 'all' || w.year === selectedYear;
    const matchesSearch = !searchTerm ||
      w.work_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.works_id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesYear && matchesSearch;
  });

  const actionBadgeCls: Record<string, string> = {
    submitted:      'bg-blue-50 text-blue-700 border-blue-200',
    forwarded:      'bg-teal-50 text-teal-700 border-teal-200',
    approved:       'bg-emerald-50 text-emerald-700 border-emerald-200',
    approved_final: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rejected:       'bg-red-50 text-red-700 border-red-200',
    sent_back:      'bg-orange-50 text-orange-700 border-orange-200',
  };

  const actionLabel: Record<string, string> = {
    submitted:      'Submitted',
    forwarded:      'Forwarded',
    approved:       'Approved',
    approved_final: 'Final Approved',
    rejected:       'Rejected',
    sent_back:      'Sent Back',
  };

  // Summary card data
  const summaryCards = [
    { label: 'Total',        count: baseRows.length,                                                                                    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'In Progress',  count: baseRows.filter(w => getEffectiveStatus(w) === 'pending_approval' || getEffectiveStatus(w) === 'in_approval').length, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'Approved',     count: baseRows.filter(w => getEffectiveStatus(w) === 'approved').length,                                 cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Sent Back',    count: baseRows.filter(w => getEffectiveStatus(w) === 'sent_back').length,                                cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    { label: 'Rejected',     count: baseRows.filter(w => getEffectiveStatus(w) === 'rejected').length,                                 cls: 'bg-red-50 text-red-700 border-red-200' },
    { label: 'Draft / Ready',count: baseRows.filter(w => ['draft', 'ready_for_approval'].includes(getEffectiveStatus(w))).length,     cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  ];

  if (loading) return <LoadingSpinner text="Loading workflow dashboard..." />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-blue-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-2xl shadow-lg">
            <GitBranch className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Approval Workflow</h1>
            <p className="text-blue-100 text-sm mt-0.5">Track and manage approval workflows for TA and TS works</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'ta' as const, label: 'Technical Approval (TA)', list: taWorks },
            { key: 'ts' as const, label: 'Technical Sanction (TS)', list: tsWorks },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {tab.label}
              <span className={`min-w-[22px] h-5 rounded-full text-[11px] font-bold flex items-center justify-center px-1.5 ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {tab.list.length}
              </span>
              {countPending(tab.list) > 0 && (
                <span className="min-w-[18px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center px-1 bg-amber-400 text-white">
                  {countPending(tab.list)}
                </span>
              )}
            </button>
          ))}
          <button onClick={() => setActiveTab('pending')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'pending' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            <Clock className="w-4 h-4" />
            Pending for Me
            {pendingWorks.length > 0 && (
              <span className={`min-w-[20px] h-5 rounded-full text-[11px] font-bold flex items-center justify-center px-1.5 ${activeTab === 'pending' ? 'bg-white text-amber-600' : 'bg-red-500 text-white'}`}>
                {pendingWorks.length}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search by work name or ID..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-sm text-gray-400">{filtered.length} works</span>
        </div>

        {/* Summary cards */}
        {(activeTab === 'ta' || activeTab === 'ts') && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {summaryCards.map(card => (
              <div key={card.label} className={`rounded-xl border px-3 py-2.5 ${card.cls}`}>
                <p className="text-[10px] font-semibold opacity-70 uppercase tracking-wider">{card.label}</p>
                <p className="text-xl font-bold mt-0.5">{card.count}</p>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-blue-800 to-blue-600">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Works ID</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Work Name</th>
                  {activeTab === 'pending' && <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Type</th>}
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
                    <td colSpan={activeTab === 'pending' ? 8 : 7} className="px-5 py-16 text-center">
                      <GitBranch className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                      <p className="text-gray-400 text-sm font-medium">
                        {activeTab === 'pending' ? 'No approvals pending for you' : 'No works found'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((work, idx) => {
                    const effStatus = getEffectiveStatus(work);
                    const isSentBack = effStatus === 'sent_back';
                    const isRejected = effStatus === 'rejected';
                    return (
                      <tr key={work.works_id}
                        className={`transition-colors hover:bg-blue-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} ${isSentBack ? 'border-l-4 border-orange-400' : isRejected ? 'border-l-4 border-red-400' : ''}`}
                      >
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-blue-700">{work.works_id}</span>
                        </td>
                        <td className="px-5 py-4 max-w-[240px]">
                          <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{work.work_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{work.division}</p>
                          {isSentBack && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 mt-1">
                              <RotateCcw className="w-2.5 h-2.5" /> Sent back — revision needed
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 mt-1">
                              <XCircle className="w-2.5 h-2.5" /> Rejected
                            </span>
                          )}
                        </td>
                        {activeTab === 'pending' && (
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${work.type === 'Technical Approval' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                              {work.type === 'Technical Approval' ? 'TA' : 'TS'}
                            </span>
                          </td>
                        )}
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                          {work.year || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <WfStatusBadge work={work} />
                        </td>
                        <td className="px-5 py-4">
                          {work.workflow ? (
                            <div className="space-y-1">
                              <Pipeline currentLevel={work.workflow.current_level} status={work.workflow.status} />
                              {isSentBack && (
                                <p className="text-[10px] text-orange-600 font-medium">Returned at {LEVELS.find(l => l.level === work.workflow!.current_level)?.short}</p>
                              )}
                              {isRejected && (
                                <p className="text-[10px] text-red-600 font-medium">Rejected at {LEVELS.find(l => l.level === work.workflow!.current_level)?.short}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Not submitted</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <EstimateApprovalActions
                              workId={work.works_id}
                              currentStatus={work.estimate_status}
                              onStatusUpdate={() => fetchData(true)}
                            />
                            {work.workflow?.status === 'pending_approval' &&
                              (hasFullAccess || work.workflow.current_approver_id === user?.id) && (
                              <button
                                onClick={() => { setSelectedWorkflow(work.workflow!); setSelectedWorkName(work.work_name); setActionForm({ action: '', comments: '' }); }}
                                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-700 to-blue-500 rounded-lg hover:from-blue-800 hover:to-blue-600 transition-all shadow-sm"
                              >
                                Take Action
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {work.workflow ? (
                            <button
                              onClick={() => fetchHistory(work)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              View
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Action Modal ── */}
      {selectedWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Take Approval Action</h2>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{selectedWorkName}</p>
              </div>
              <button onClick={() => setSelectedWorkflow(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Stage</p>
                <Pipeline currentLevel={selectedWorkflow.current_level} status={selectedWorkflow.status} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Action *</label>
                <select
                  value={actionForm.action}
                  onChange={e => setActionForm({ ...actionForm, action: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose an action...</option>
                  <option value="approved">Approve &amp; Forward to Next Level</option>
                  {(hasFullAccess || selectedWorkflow.current_level === 4) && (
                    <option value="approved_final">Final Approve (Complete Workflow)</option>
                  )}
                  <option value="sent_back">Send Back for Revision</option>
                  <option value="rejected">Reject</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Comments {(actionForm.action === 'sent_back' || actionForm.action === 'rejected') && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={actionForm.comments}
                  onChange={e => setActionForm({ ...actionForm, comments: e.target.value })}
                  rows={3}
                  placeholder={actionForm.action === 'sent_back' ? 'Explain what needs to be revised...' : actionForm.action === 'rejected' ? 'State the reason for rejection...' : 'Add remarks (optional)...'}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                {(actionForm.action === 'sent_back' || actionForm.action === 'rejected') && !actionForm.comments.trim() && (
                  <p className="text-xs text-red-500 mt-1">Comments are required for this action.</p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setSelectedWorkflow(null); setActionForm({ action: '', comments: '' }); }}
                className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={
                  submittingAction ||
                  !actionForm.action ||
                  ((actionForm.action === 'sent_back' || actionForm.action === 'rejected') && !actionForm.comments.trim())
                }
                className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                  actionForm.action === 'rejected' ? 'bg-red-600 hover:bg-red-700' :
                  actionForm.action === 'sent_back' ? 'bg-orange-500 hover:bg-orange-600' :
                  'bg-gradient-to-r from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600'
                }`}
              >
                {submittingAction ? 'Processing...' : 'Submit Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Side Panel ── */}
      {historyWorkId && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setHistoryWorkId(null)} />
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col">
            <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-6 py-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Approval History</h2>
                <p className="text-blue-100 text-xs mt-0.5 line-clamp-2">{historyWorkName}</p>
              </div>
              <button onClick={() => setHistoryWorkId(null)} className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {historyWorkflow && (
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Pipeline State</p>
                <Pipeline currentLevel={historyWorkflow.current_level} status={historyWorkflow.status} />
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No approval history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry, idx) => {
                    const dotColor =
                      entry.action === 'approved' || entry.action === 'approved_final' ? 'border-emerald-500' :
                      entry.action === 'rejected' ? 'border-red-500' :
                      entry.action === 'sent_back' ? 'border-orange-500' :
                      'border-blue-500';
                    return (
                      <div key={entry.id} className="relative pl-8">
                        {idx < history.length - 1 && <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-gray-200" />}
                        <div className={`absolute left-1.5 top-2 w-3 h-3 rounded-full border-2 bg-white ${dotColor}`} />
                        <div className={`rounded-xl p-3.5 border ${
                          entry.action === 'sent_back' ? 'bg-orange-50 border-orange-200' :
                          entry.action === 'rejected'  ? 'bg-red-50 border-red-200' :
                          entry.action === 'approved' || entry.action === 'approved_final' ? 'bg-emerald-50 border-emerald-200' :
                          'bg-gray-50 border-gray-200'
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${actionBadgeCls[entry.action] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                  {actionLabel[entry.action] || entry.action}
                                </span>
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                  <User className="w-3 h-3" />
                                  <span className="font-semibold">{entry.approver_name}</span>
                                  <span className="text-gray-400">· {entry.role_name}</span>
                                </div>
                              </div>
                              {entry.comments && (
                                <p className={`text-xs mt-1.5 rounded-lg px-3 py-2 border italic ${
                                  entry.action === 'sent_back' ? 'text-orange-700 bg-white border-orange-200' :
                                  entry.action === 'rejected'  ? 'text-red-700 bg-white border-red-200' :
                                  'text-gray-600 bg-white border-gray-200'
                                }`}>
                                  "{entry.comments}"
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 text-right">
                              {new Date(entry.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}<br />
                              {new Date(entry.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowDashboard;
