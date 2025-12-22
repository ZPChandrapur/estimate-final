import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, History, Search, Filter, Calendar } from 'lucide-react';

interface MBAuditLogsProps {
  onNavigate: (page: string) => void;
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
}

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
  user: {
    email: string;
  };
}

const MBAuditLogs: React.FC<MBAuditLogsProps> = ({ onNavigate }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchAuditLogs();
    }
  }, [selectedProject, filterAction, dateFrom, dateTo]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('mb_projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .schema('estimate')
        .from('mb_audit_logs')
        .select(`
          *,
          user:auth.users(email)
        `)
        .eq('project_id', selectedProject)
        .order('created_at', { ascending: false });

      if (filterAction !== 'all') {
        query = query.eq('action', filterAction);
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAuditLogs(data as any || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, { text: string; color: string }> = {
      boq_uploaded: { text: 'BOQ Uploaded', color: 'bg-blue-100 text-blue-800' },
      measurement_saved: { text: 'Measurement Saved', color: 'bg-gray-100 text-gray-800' },
      measurement_submitted: { text: 'Measurement Submitted', color: 'bg-yellow-100 text-yellow-800' },
      measurement_approved: { text: 'Measurement Approved', color: 'bg-green-100 text-green-800' },
      measurement_rejected: { text: 'Measurement Rejected', color: 'bg-red-100 text-red-800' },
      report_generated: { text: 'Report Generated', color: 'bg-purple-100 text-purple-800' }
    };
    return labels[action] || { text: action, color: 'bg-gray-100 text-gray-800' };
  };

  const filteredLogs = auditLogs.filter(log =>
    (log.user as any)?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-2">Complete audit trail of all MB activities</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Project --</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action Filter
              </label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Actions</option>
                <option value="boq_uploaded">BOQ Uploaded</option>
                <option value="measurement_submitted">Measurement Submitted</option>
                <option value="measurement_approved">Measurement Approved</option>
                <option value="measurement_rejected">Measurement Rejected</option>
                <option value="report_generated">Report Generated</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by user email or action..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {selectedProject && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Audit Trail ({filteredLogs.length} entries)
              </h3>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading audit logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center">
                <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No audit logs found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredLogs.map((log) => {
                  const actionLabel = getActionLabel(log.action);
                  return (
                    <div key={log.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${actionLabel.color}`}>
                              {actionLabel.text}
                            </span>
                            <span className="text-sm text-gray-600">
                              by {(log.user as any)?.email || 'Unknown User'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            <span className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <div className="mt-2 bg-gray-50 rounded-lg p-3">
                              <p className="text-xs font-medium text-gray-700 mb-1">Details:</p>
                              <pre className="text-xs text-gray-600 overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MBAuditLogs;
