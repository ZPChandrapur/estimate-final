import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  ThumbsUp,
  ThumbsDown,
  MessageSquare
} from 'lucide-react';

interface MBStatusProps {
  onNavigate: (page: string) => void;
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
}

interface Measurement {
  id: string;
  measurement_number: string;
  measurement_date: string;
  description: string;
  quantity: number;
  amount: number;
  status: string;
  remarks: string;
  rejection_reason: string | null;
  boq_item: {
    item_number: string;
    description: string;
    unit: string;
  };
  created_by_user: {
    email: string;
  };
}

const MBStatus: React.FC<MBStatusProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [selectedMeasurement, setSelectedMeasurement] = useState<Measurement | null>(null);
  const [loading, setLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approved' | 'rejected' | ''>('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    fetchProjects();
    fetchUserRoles();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchMeasurements();
    }
  }, [selectedProject]);

  const fetchUserRoles = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role_id, roles(name)')
        .eq('user_id', user.id);

      const roles = data?.map((ur: any) => ur.roles.name) || [];
      setUserRoles(roles);
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  };

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

  const fetchMeasurements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('mb_measurements')
        .select(`
          *,
          boq_item:mb_boq_items(item_number, description, unit),
          created_by_user:auth.users(email)
        `)
        .eq('project_id', selectedProject)
        .order('measurement_date', { ascending: false });

      if (error) throw error;
      setMeasurements(data as any || []);
    } catch (error) {
      console.error('Error fetching measurements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      draft: { label: 'Draft', color: 'gray', icon: Clock, bgColor: 'bg-gray-100', textColor: 'text-gray-700' },
      submitted: { label: 'Submitted', color: 'yellow', icon: Clock, bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
      je_approved: { label: 'JE Approved', color: 'blue', icon: CheckCircle, bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
      de_approved: { label: 'DE Approved', color: 'green', icon: CheckCircle, bgColor: 'bg-green-100', textColor: 'text-green-700' },
      ee_approved: { label: 'EE Approved', color: 'purple', icon: CheckCircle, bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
      rejected: { label: 'Rejected', color: 'red', icon: XCircle, bgColor: 'bg-red-100', textColor: 'text-red-700' }
    };
    return configs[status as keyof typeof configs] || configs.draft;
  };

  const canApprove = (measurement: Measurement) => {
    if (userRoles.includes('admin')) return true;

    if (measurement.status === 'submitted' && userRoles.includes('Junior Engineer')) return true;
    if (measurement.status === 'je_approved' && userRoles.includes('Deputy Engineer')) return true;
    if (measurement.status === 'de_approved' && userRoles.includes('Executive Engineer')) return true;

    return false;
  };

  const handleApprove = (measurement: Measurement, action: 'approved' | 'rejected') => {
    setSelectedMeasurement(measurement);
    setApprovalAction(action);
    setShowApprovalModal(true);
  };

  const submitApproval = async () => {
    if (!selectedMeasurement || !user || !approvalAction) return;

    try {
      let newStatus = selectedMeasurement.status;
      let approverRole = '';

      if (userRoles.includes('Junior Engineer') || userRoles.includes('admin')) {
        approverRole = 'Junior Engineer';
        newStatus = approvalAction === 'approved' ? 'je_approved' : 'rejected';
      } else if (userRoles.includes('Deputy Engineer')) {
        approverRole = 'Deputy Engineer';
        newStatus = approvalAction === 'approved' ? 'de_approved' : 'rejected';
      } else if (userRoles.includes('Executive Engineer')) {
        approverRole = 'Executive Engineer';
        newStatus = approvalAction === 'approved' ? 'ee_approved' : 'rejected';
      }

      const { error: updateError } = await supabase
        .schema('estimate')
        .from('mb_measurements')
        .update({
          status: newStatus,
          rejection_reason: approvalAction === 'rejected' ? approvalRemarks : null
        })
        .eq('id', selectedMeasurement.id);

      if (updateError) throw updateError;

      await supabase
        .schema('estimate')
        .from('mb_approvals')
        .insert({
          measurement_id: selectedMeasurement.id,
          project_id: selectedProject,
          approver_role: approverRole,
          approver_id: user.id,
          action: approvalAction,
          remarks: approvalRemarks
        });

      await supabase
        .schema('estimate')
        .from('mb_audit_logs')
        .insert({
          project_id: selectedProject,
          user_id: user.id,
          action: `measurement_${approvalAction}`,
          entity_type: 'approval',
          entity_id: selectedMeasurement.id,
          details: {
            measurement_number: selectedMeasurement.measurement_number,
            approver_role: approverRole,
            remarks: approvalRemarks
          }
        });

      setShowApprovalModal(false);
      setApprovalRemarks('');
      setApprovalAction('');
      setSelectedMeasurement(null);
      fetchMeasurements();
    } catch (error) {
      console.error('Error submitting approval:', error);
    }
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Measurement Book Status</h1>
          <p className="text-gray-600 mt-2">Track and manage measurement approvals</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Project
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a Project --</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.project_code} - {project.project_name}
              </option>
            ))}
          </select>
        </div>

        {selectedProject && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Measurements ({measurements.length})
              </h3>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading measurements...</p>
              </div>
            ) : measurements.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No measurements found for this project</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {measurements.map((measurement) => {
                  const statusConfig = getStatusConfig(measurement.status);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div key={measurement.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="text-lg font-semibold text-gray-900">
                              {measurement.measurement_number}
                            </span>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">BOQ Item:</span>
                              <p className="font-medium text-gray-900">{measurement.boq_item?.item_number}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Date:</span>
                              <p className="font-medium text-gray-900">
                                {new Date(measurement.measurement_date).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-600">Quantity:</span>
                              <p className="font-medium text-gray-900">
                                {measurement.quantity.toFixed(3)} {measurement.boq_item?.unit}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-600">Amount:</span>
                              <p className="font-medium text-green-600">₹{measurement.amount.toFixed(2)}</p>
                            </div>
                          </div>
                          {measurement.description && (
                            <p className="text-sm text-gray-600 mt-2">{measurement.description}</p>
                          )}
                          {measurement.rejection_reason && (
                            <div className="mt-2 flex items-start bg-red-50 border border-red-200 rounded-lg p-3">
                              <AlertCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5" />
                              <div>
                                <p className="text-xs font-medium text-red-800">Rejection Reason:</p>
                                <p className="text-sm text-red-700">{measurement.rejection_reason}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {canApprove(measurement) && (
                          <div className="flex space-x-2 ml-4">
                            <button
                              onClick={() => handleApprove(measurement, 'approved')}
                              className="flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                            >
                              <ThumbsUp className="w-4 h-4 mr-1" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleApprove(measurement, 'rejected')}
                              className="flex items-center px-3 py-1.5 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                            >
                              <ThumbsDown className="w-4 h-4 mr-1" />
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {showApprovalModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {approvalAction === 'approved' ? 'Approve' : 'Reject'} Measurement
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks {approvalAction === 'rejected' && '*'}
                </label>
                <textarea
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={approvalAction === 'rejected' ? 'Provide reason for rejection' : 'Optional remarks'}
                  required={approvalAction === 'rejected'}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setApprovalRemarks('');
                    setApprovalAction('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitApproval}
                  disabled={approvalAction === 'rejected' && !approvalRemarks}
                  className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
                    approvalAction === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  } disabled:opacity-50`}
                >
                  Confirm {approvalAction === 'approved' ? 'Approval' : 'Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MBStatus;
