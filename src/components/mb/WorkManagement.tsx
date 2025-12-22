import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft,
  Save,
  Plus,
  Search,
  Building,
  Users,
  UserCog,
  FolderTree,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';

interface WorkManagementProps {
  onNavigate: (page: string) => void;
}

interface EstimateWork {
  works_id: string;
  work_name: string;
  total_estimated_cost: number;
}

interface MBProject {
  id: string;
  project_code: string;
  project_name: string;
  works_id?: string;
  status: string;
}

interface Contractor {
  id?: string;
  project_id: string;
  contractor_name: string;
  pan_no: string;
  contractor_type: string;
  contractor_class: string;
  contact_person_first_name: string;
  contact_person_last_name: string;
  mobile_no: string;
  pin_code: string;
  address: string;
  city_location: string;
  gst_no: string;
  email: string;
  business_type: string;
}

interface RoleAssignment {
  role_type: string;
  user_id: string;
  user_name: string;
}

interface Subwork {
  id?: string;
  subworks_id?: string;
  subwork_name: string;
  subwork_description: string;
  estimated_amount: number;
  is_from_estimate: boolean;
}

const WorkManagement: React.FC<WorkManagementProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [projects, setProjects] = useState<MBProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [estimateWorks, setEstimateWorks] = useState<EstimateWork[]>([]);
  const [showWorksList, setShowWorksList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [workDetails, setWorkDetails] = useState({
    project_code: '',
    project_name: '',
    works_id: '',
    tender_no: '',
    tender_submission_date: '',
    tender_opening_date: '',
    work_order_date: '',
    start_date: '',
    work_duration_months: '',
    work_duration_days: '',
    work_end_date: '',
    work_order_outward_no: '',
    agreement_reference_no: '',
    state: 'Maharashtra',
    city_location: '',
    region: '',
    tender_type: '',
    type_of_work: '',
    select_programme: '',
    select_scheme: '',
    consider_escalation: false,
    cost_put_to_tender: '',
    above_below_percentage: '',
    above_below_percentage_cl38: '',
    quoted_amount: '',
    total_security_deposit: '',
    initial_security_deposit: '',
    additional_security_deposit: '',
    cl38_amount: '',
    retention_money_deposit: ''
  });

  const [contractor, setContractor] = useState<Contractor>({
    project_id: '',
    contractor_name: '',
    pan_no: '',
    contractor_type: '',
    contractor_class: '',
    contact_person_first_name: '',
    contact_person_last_name: '',
    mobile_no: '',
    pin_code: '',
    address: '',
    city_location: '',
    gst_no: '',
    email: '',
    business_type: ''
  });

  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string }[]>([]);
  const [subworks, setSubworks] = useState<Subwork[]>([]);
  const [estimateSubworks, setEstimateSubworks] = useState<any[]>([]);

  const steps = [
    { id: 0, label: 'Work Details', icon: Building },
    { id: 1, label: 'Contractor Details', icon: Users },
    { id: 2, label: 'Role Assignments', icon: UserCog },
    { id: 3, label: 'Subworks', icon: FolderTree }
  ];

  useEffect(() => {
    fetchProjects();
    fetchEstimateWorks();
    fetchAvailableUsers();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadProjectData(selectedProject);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (workDetails.works_id) {
      fetchEstimateSubworks(workDetails.works_id);
    }
  }, [workDetails.works_id]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('mb_projects')
        .select('id, project_code, project_name, works_id, status')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchEstimateWorks = async () => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('works')
        .select('works_id, work_name, total_estimated_cost')
        .order('work_name');

      if (error) throw error;
      setEstimateWorks(data || []);
    } catch (error) {
      console.error('Error fetching estimate works:', error);
      showMessage('error', 'Failed to fetch works from estimate system');
    }
  };

  const fetchEstimateSubworks = async (worksId: string) => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('subworks_id, subworks_name, subwork_amount')
        .eq('works_id', worksId)
        .order('subworks_name');

      if (error) throw error;
      setEstimateSubworks(data || []);
    } catch (error) {
      console.error('Error fetching estimate subworks:', error);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, name')
        .order('name');

      if (error) throw error;
      const users = (data || []).map(u => ({ id: u.user_id, name: u.name }));
      setAvailableUsers(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      showMessage('error', 'Failed to fetch users for role assignment');
    }
  };

  const loadProjectData = async (projectId: string) => {
    try {
      setLoading(true);

      const { data: project, error: projectError } = await supabase
        .schema('estimate')
        .from('mb_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      if (project) {
        setWorkDetails({
          project_code: project.project_code || '',
          project_name: project.project_name || '',
          works_id: project.works_id || '',
          tender_no: project.tender_no || '',
          tender_submission_date: project.tender_submission_date || '',
          tender_opening_date: project.tender_opening_date || '',
          work_order_date: project.work_order_date || '',
          start_date: project.start_date || '',
          work_duration_months: project.work_duration_months || '',
          work_duration_days: project.work_duration_days || '',
          work_end_date: project.work_end_date || '',
          work_order_outward_no: project.work_order_outward_no || '',
          agreement_reference_no: project.agreement_reference_no || '',
          state: project.state || 'Maharashtra',
          city_location: project.city_location || '',
          region: project.region || '',
          tender_type: project.tender_type || '',
          type_of_work: project.type_of_work || '',
          select_programme: project.select_programme || '',
          select_scheme: project.select_scheme || '',
          consider_escalation: project.consider_escalation || false,
          cost_put_to_tender: project.cost_put_to_tender || '',
          above_below_percentage: project.above_below_percentage || '',
          above_below_percentage_cl38: project.above_below_percentage_cl38 || '',
          quoted_amount: project.quoted_amount || '',
          total_security_deposit: project.total_security_deposit || '',
          initial_security_deposit: project.initial_security_deposit || '',
          additional_security_deposit: project.additional_security_deposit || '',
          cl38_amount: project.cl38_amount || '',
          retention_money_deposit: project.retention_money_deposit || ''
        });
      }

      const { data: contractorData, error: contractorError } = await supabase
        .schema('estimate')
        .from('mb_contractors')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (!contractorError && contractorData) {
        setContractor(contractorData);
      }

      const { data: rolesData, error: rolesError } = await supabase
        .schema('estimate')
        .from('mb_work_role_assignments')
        .select(`
          role_type,
          user_id
        `)
        .eq('project_id', projectId);

      if (!rolesError && rolesData) {
        const userIds = rolesData.map(r => r.user_id);
        const { data: usersData } = await supabase
          .from('user_roles')
          .select('user_id, name')
          .in('user_id', userIds);

        const rolesWithNames = rolesData.map(r => {
          const user = usersData?.find(u => u.user_id === r.user_id);
          return {
            role_type: r.role_type,
            user_id: r.user_id,
            user_name: user?.name || ''
          };
        });
        setRoleAssignments(rolesWithNames);
      }

      const { data: subworksData, error: subworksError } = await supabase
        .schema('estimate')
        .from('mb_work_subworks')
        .select('*')
        .eq('project_id', projectId);

      if (!subworksError && subworksData) {
        setSubworks(subworksData);
      }
    } catch (error) {
      console.error('Error loading project data:', error);
      showMessage('error', 'Failed to load project data');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchWork = (work: EstimateWork) => {
    setWorkDetails(prev => ({
      ...prev,
      works_id: work.works_id,
      project_code: work.works_id,
      project_name: work.work_name,
      quoted_amount: work.total_estimated_cost.toString()
    }));
    setShowWorksList(false);
    showMessage('success', `Work "${work.work_name}" loaded. Associated subworks will be available in Subworks tab.`);
  };

  const saveWorkDetails = async () => {
    try {
      setLoading(true);

      const projectData = {
        project_code: workDetails.project_code,
        project_name: workDetails.project_name,
        works_id: workDetails.works_id || null,
        tender_no: workDetails.tender_no || null,
        tender_submission_date: workDetails.tender_submission_date || null,
        tender_opening_date: workDetails.tender_opening_date || null,
        work_order_date: workDetails.work_order_date || null,
        start_date: workDetails.start_date,
        work_duration_months: workDetails.work_duration_months ? parseInt(workDetails.work_duration_months) : null,
        work_duration_days: workDetails.work_duration_days ? parseInt(workDetails.work_duration_days) : null,
        work_end_date: workDetails.work_end_date || null,
        work_order_outward_no: workDetails.work_order_outward_no || null,
        agreement_reference_no: workDetails.agreement_reference_no || null,
        state: workDetails.state,
        city_location: workDetails.city_location || null,
        region: workDetails.region || null,
        tender_type: workDetails.tender_type || null,
        type_of_work: workDetails.type_of_work || null,
        select_programme: workDetails.select_programme || null,
        select_scheme: workDetails.select_scheme || null,
        consider_escalation: workDetails.consider_escalation,
        cost_put_to_tender: workDetails.cost_put_to_tender ? parseFloat(workDetails.cost_put_to_tender) : null,
        above_below_percentage: workDetails.above_below_percentage ? parseFloat(workDetails.above_below_percentage) : null,
        above_below_percentage_cl38: workDetails.above_below_percentage_cl38 ? parseFloat(workDetails.above_below_percentage_cl38) : null,
        quoted_amount: workDetails.quoted_amount ? parseFloat(workDetails.quoted_amount) : null,
        total_security_deposit: workDetails.total_security_deposit ? parseFloat(workDetails.total_security_deposit) : null,
        initial_security_deposit: workDetails.initial_security_deposit ? parseFloat(workDetails.initial_security_deposit) : null,
        additional_security_deposit: workDetails.additional_security_deposit ? parseFloat(workDetails.additional_security_deposit) : null,
        cl38_amount: workDetails.cl38_amount ? parseFloat(workDetails.cl38_amount) : null,
        retention_money_deposit: workDetails.retention_money_deposit || null,
        status: 'active',
        created_by: user?.id
      };

      let projectId = selectedProject;

      if (selectedProject) {
        const { error } = await supabase
          .schema('estimate')
          .from('mb_projects')
          .update(projectData)
          .eq('id', selectedProject);

        if (error) throw error;
        showMessage('success', 'Work details updated successfully');
      } else {
        const { data, error } = await supabase
          .schema('estimate')
          .from('mb_projects')
          .insert(projectData)
          .select()
          .single();

        if (error) throw error;
        projectId = data.id;
        setSelectedProject(projectId);
        showMessage('success', 'Work created successfully');
        fetchProjects();
      }

      setCurrentStep(1);
    } catch (error: any) {
      console.error('Error saving work details:', error);
      showMessage('error', error.message || 'Failed to save work details');
    } finally {
      setLoading(false);
    }
  };

  const saveContractor = async () => {
    if (!selectedProject) {
      showMessage('error', 'Please save work details first');
      return;
    }

    try {
      setLoading(true);

      const contractorData = {
        ...contractor,
        project_id: selectedProject,
        created_by: user?.id
      };

      if (contractor.id) {
        const { error } = await supabase
          .schema('estimate')
          .from('mb_contractors')
          .update(contractorData)
          .eq('id', contractor.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .schema('estimate')
          .from('mb_contractors')
          .insert(contractorData);

        if (error) throw error;
      }

      showMessage('success', 'Contractor details saved successfully');
      setCurrentStep(2);
    } catch (error: any) {
      console.error('Error saving contractor:', error);
      showMessage('error', error.message || 'Failed to save contractor details');
    } finally {
      setLoading(false);
    }
  };

  const saveRoleAssignments = async () => {
    if (!selectedProject) {
      showMessage('error', 'Please save work details first');
      return;
    }

    try {
      setLoading(true);

      await supabase
        .schema('estimate')
        .from('mb_work_role_assignments')
        .delete()
        .eq('project_id', selectedProject);

      if (roleAssignments.length > 0) {
        const assignments = roleAssignments.map(ra => ({
          project_id: selectedProject,
          role_type: ra.role_type,
          user_id: ra.user_id,
          assigned_by: user?.id
        }));

        const { error } = await supabase
          .schema('estimate')
          .from('mb_work_role_assignments')
          .insert(assignments);

        if (error) throw error;
      }

      showMessage('success', 'Role assignments saved successfully');
      setCurrentStep(3);
    } catch (error: any) {
      console.error('Error saving role assignments:', error);
      showMessage('error', error.message || 'Failed to save role assignments');
    } finally {
      setLoading(false);
    }
  };

  const saveSubworks = async () => {
    if (!selectedProject) {
      showMessage('error', 'Please save work details first');
      return;
    }

    try {
      setLoading(true);

      await supabase
        .schema('estimate')
        .from('mb_work_subworks')
        .delete()
        .eq('project_id', selectedProject);

      if (subworks.length > 0) {
        const subworksData = subworks.map(sw => ({
          project_id: selectedProject,
          subworks_id: sw.subworks_id || null,
          subwork_name: sw.subwork_name,
          subwork_description: sw.subwork_description || null,
          estimated_amount: sw.estimated_amount,
          is_from_estimate: sw.is_from_estimate,
          created_by: user?.id
        }));

        const { error } = await supabase
          .schema('estimate')
          .from('mb_work_subworks')
          .insert(subworksData);

        if (error) throw error;
      }

      showMessage('success', 'Subworks saved successfully. You can now proceed to BOQ Management.');
    } catch (error: any) {
      console.error('Error saving subworks:', error);
      showMessage('error', error.message || 'Failed to save subworks');
    } finally {
      setLoading(false);
    }
  };

  const addRoleAssignment = () => {
    setRoleAssignments([...roleAssignments, { role_type: 'JE', user_id: '', user_name: '' }]);
  };

  const updateRoleAssignment = (index: number, field: string, value: string) => {
    const updated = [...roleAssignments];
    if (field === 'user_id') {
      const user = availableUsers.find(u => u.id === value);
      updated[index].user_id = value;
      updated[index].user_name = user?.name || '';
    } else {
      updated[index][field as keyof RoleAssignment] = value;
    }
    setRoleAssignments(updated);
  };

  const removeRoleAssignment = (index: number) => {
    setRoleAssignments(roleAssignments.filter((_, i) => i !== index));
  };

  const addSubwork = () => {
    setSubworks([...subworks, {
      subwork_name: '',
      subwork_description: '',
      estimated_amount: 0,
      is_from_estimate: false
    }]);
  };

  const addEstimateSubwork = (esw: any) => {
    if (!subworks.find(sw => sw.subworks_id === esw.subworks_id)) {
      setSubworks([...subworks, {
        subworks_id: esw.subworks_id,
        subwork_name: esw.subworks_name,
        subwork_description: '',
        estimated_amount: esw.subwork_amount,
        is_from_estimate: true
      }]);
    }
  };

  const updateSubwork = (index: number, field: string, value: any) => {
    const updated = [...subworks];
    updated[index] = { ...updated[index], [field]: value };
    setSubworks(updated);
  };

  const removeSubwork = (index: number) => {
    setSubworks(subworks.filter((_, i) => i !== index));
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => onNavigate('dashboard')}
                className="flex items-center px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </button>
              <h2 className="text-2xl font-bold text-gray-900">Work Management</h2>
            </div>
          </div>

          {message && (
            <div className={`mx-6 mt-4 p-4 rounded-lg flex items-center justify-between ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              <div className="flex items-center">
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 mr-2" />
                )}
                <span>{message.text}</span>
              </div>
              <button onClick={() => setMessage(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-4 mb-4">
              <label className="text-sm font-medium text-gray-700">Select Existing Project:</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Create New Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.project_code ? `${p.project_code} - ` : ''}{p.project_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <React.Fragment key={step.id}>
                    <button
                      onClick={() => setCurrentStep(step.id)}
                      className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : isCompleted
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {step.label}
                    </button>
                    {index < steps.length - 1 && (
                      <div className="flex-1 h-0.5 bg-gray-300"></div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {currentStep === 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Work Details</h3>
                  <button
                    onClick={() => setShowWorksList(!showWorksList)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Fetch from Estimate
                  </button>
                </div>

                {showWorksList && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Select Work from Estimate</h4>
                      <button
                        onClick={() => setShowWorksList(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    {estimateWorks.length === 0 ? (
                      <div className="text-center py-4 text-gray-600">
                        No works found in estimate system
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {estimateWorks.map(work => (
                          <button
                            key={work.works_id}
                            onClick={() => handleFetchWork(work)}
                            className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-100 hover:border-blue-400 transition-colors"
                          >
                            <div className="font-medium text-gray-900">{work.work_name}</div>
                            <div className="text-sm text-gray-600">Estimate No: {work.works_id} | Amount: ₹{work.total_estimated_cost.toLocaleString('en-IN')}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {workDetails.works_id && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center text-green-800">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      <span className="font-medium">Work loaded from Estimate (Estimate No: {workDetails.works_id})</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimate Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={workDetails.project_code}
                      onChange={(e) => setWorkDetails({ ...workDetails, project_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 2025-TS-121"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name of Work <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={workDetails.project_name}
                      onChange={(e) => setWorkDetails({ ...workDetails, project_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work ID/Tender No</label>
                    <input
                      type="text"
                      value={workDetails.tender_no}
                      onChange={(e) => setWorkDetails({ ...workDetails, tender_no: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tender Submission Date</label>
                    <input
                      type="date"
                      value={workDetails.tender_submission_date}
                      onChange={(e) => setWorkDetails({ ...workDetails, tender_submission_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tender Opening Date</label>
                    <input
                      type="date"
                      value={workDetails.tender_opening_date}
                      onChange={(e) => setWorkDetails({ ...workDetails, tender_opening_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work Order Date</label>
                    <input
                      type="date"
                      value={workDetails.work_order_date}
                      onChange={(e) => setWorkDetails({ ...workDetails, work_order_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date of Work <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={workDetails.start_date}
                      onChange={(e) => setWorkDetails({ ...workDetails, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work Duration (Months)</label>
                    <input
                      type="number"
                      value={workDetails.work_duration_months}
                      onChange={(e) => setWorkDetails({ ...workDetails, work_duration_months: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work Duration (Days)</label>
                    <input
                      type="number"
                      value={workDetails.work_duration_days}
                      onChange={(e) => setWorkDetails({ ...workDetails, work_duration_days: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date of Work</label>
                    <input
                      type="date"
                      value={workDetails.work_end_date}
                      onChange={(e) => setWorkDetails({ ...workDetails, work_end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work Order Outward No</label>
                    <input
                      type="text"
                      value={workDetails.work_order_outward_no}
                      onChange={(e) => setWorkDetails({ ...workDetails, work_order_outward_no: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agreement Reference No</label>
                    <input
                      type="text"
                      value={workDetails.agreement_reference_no}
                      onChange={(e) => setWorkDetails({ ...workDetails, agreement_reference_no: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={workDetails.state}
                      onChange={(e) => setWorkDetails({ ...workDetails, state: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City/Location</label>
                    <input
                      type="text"
                      value={workDetails.city_location}
                      onChange={(e) => setWorkDetails({ ...workDetails, city_location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                    <input
                      type="text"
                      value={workDetails.region}
                      onChange={(e) => setWorkDetails({ ...workDetails, region: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tender Type</label>
                    <input
                      type="text"
                      value={workDetails.tender_type}
                      onChange={(e) => setWorkDetails({ ...workDetails, tender_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type of Work</label>
                    <input
                      type="text"
                      value={workDetails.type_of_work}
                      onChange={(e) => setWorkDetails({ ...workDetails, type_of_work: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Programme</label>
                    <input
                      type="text"
                      value={workDetails.select_programme}
                      onChange={(e) => setWorkDetails({ ...workDetails, select_programme: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Scheme</label>
                    <input
                      type="text"
                      value={workDetails.select_scheme}
                      onChange={(e) => setWorkDetails({ ...workDetails, select_scheme: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={workDetails.consider_escalation}
                        onChange={(e) => setWorkDetails({ ...workDetails, consider_escalation: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Consider Escalation for Site</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost Put to Tender</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workDetails.cost_put_to_tender}
                      onChange={(e) => setWorkDetails({ ...workDetails, cost_put_to_tender: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Above/Below Percentage</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workDetails.above_below_percentage}
                      onChange={(e) => setWorkDetails({ ...workDetails, above_below_percentage: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Above/Below Percentage For cl-38</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workDetails.above_below_percentage_cl38}
                      onChange={(e) => setWorkDetails({ ...workDetails, above_below_percentage_cl38: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quoted Amount (Rs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workDetails.quoted_amount}
                      onChange={(e) => setWorkDetails({ ...workDetails, quoted_amount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Security Deposit</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workDetails.total_security_deposit}
                      onChange={(e) => setWorkDetails({ ...workDetails, total_security_deposit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Initial Security Deposit</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workDetails.initial_security_deposit}
                      onChange={(e) => setWorkDetails({ ...workDetails, initial_security_deposit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Security Deposit</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workDetails.additional_security_deposit}
                      onChange={(e) => setWorkDetails({ ...workDetails, additional_security_deposit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cl38 Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workDetails.cl38_amount}
                      onChange={(e) => setWorkDetails({ ...workDetails, cl38_amount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Retention Money Deposit</label>
                    <input
                      type="text"
                      value={workDetails.retention_money_deposit}
                      onChange={(e) => setWorkDetails({ ...workDetails, retention_money_deposit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={saveWorkDetails}
                    disabled={loading || !workDetails.project_code || !workDetails.project_name || !workDetails.start_date}
                    className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {loading ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contractor Details</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name of Contractor/Firm <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={contractor.contractor_name}
                      onChange={(e) => setContractor({ ...contractor, contractor_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PAN No</label>
                    <input
                      type="text"
                      value={contractor.pan_no}
                      onChange={(e) => setContractor({ ...contractor, pan_no: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Type</label>
                    <input
                      type="text"
                      value={contractor.contractor_type}
                      onChange={(e) => setContractor({ ...contractor, contractor_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Class</label>
                    <input
                      type="text"
                      value={contractor.contractor_class}
                      onChange={(e) => setContractor({ ...contractor, contractor_class: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person First Name</label>
                    <input
                      type="text"
                      value={contractor.contact_person_first_name}
                      onChange={(e) => setContractor({ ...contractor, contact_person_first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person Last Name</label>
                    <input
                      type="text"
                      value={contractor.contact_person_last_name}
                      onChange={(e) => setContractor({ ...contractor, contact_person_last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile No</label>
                    <input
                      type="text"
                      value={contractor.mobile_no}
                      onChange={(e) => setContractor({ ...contractor, mobile_no: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pin Code</label>
                    <input
                      type="text"
                      value={contractor.pin_code}
                      onChange={(e) => setContractor({ ...contractor, pin_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={contractor.address}
                      onChange={(e) => setContractor({ ...contractor, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City/Location</label>
                    <input
                      type="text"
                      value={contractor.city_location}
                      onChange={(e) => setContractor({ ...contractor, city_location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GST No</label>
                    <input
                      type="text"
                      value={contractor.gst_no}
                      onChange={(e) => setContractor({ ...contractor, gst_no: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email-ID</label>
                    <input
                      type="email"
                      value={contractor.email}
                      onChange={(e) => setContractor({ ...contractor, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                    <input
                      type="text"
                      value={contractor.business_type}
                      onChange={(e) => setContractor({ ...contractor, business_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setCurrentStep(0)}
                    className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={saveContractor}
                    disabled={loading || !contractor.contractor_name}
                    className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {loading ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Role Assignments</h3>
                  <button
                    onClick={addRoleAssignment}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Role
                  </button>
                </div>

                <div className="space-y-4">
                  {roleAssignments.map((ra, index) => (
                    <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role Type</label>
                        <select
                          value={ra.role_type}
                          onChange={(e) => updateRoleAssignment(index, 'role_type', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="Auditor">Auditor</option>
                          <option value="JE">JE</option>
                          <option value="JE_Div">JE (Div)</option>
                          <option value="Deputy Engineer">Deputy Engineer</option>
                          <option value="Executive Engineer">Executive Engineer</option>
                          <option value="Accountant">Accountant</option>
                        </select>
                      </div>

                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assign User</label>
                        <select
                          value={ra.user_id}
                          onChange={(e) => updateRoleAssignment(index, 'user_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select User</option>
                          {availableUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => removeRoleAssignment(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}

                  {roleAssignments.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No role assignments yet. Click "Add Role" to assign roles.
                    </div>
                  )}
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={saveRoleAssignments}
                    disabled={loading}
                    className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {loading ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Subworks</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={addSubwork}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Manual Subwork
                    </button>
                  </div>
                </div>

                {workDetails.works_id && estimateSubworks.length > 0 && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-3">Available Subworks from Estimate</h4>
                    <div className="space-y-2">
                      {estimateSubworks.map(esw => (
                        <div key={esw.subworks_id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900">{esw.subworks_name}</div>
                            <div className="text-sm text-gray-600">Amount: ₹{esw.subwork_amount?.toLocaleString('en-IN')}</div>
                          </div>
                          <button
                            onClick={() => addEstimateSubwork(esw)}
                            disabled={subworks.some(sw => sw.subworks_id === esw.subworks_id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                          >
                            {subworks.some(sw => sw.subworks_id === esw.subworks_id) ? 'Added' : 'Add'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {subworks.map((sw, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          sw.is_from_estimate ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {sw.is_from_estimate ? 'From Estimate' : 'Manual Entry'}
                        </span>
                        <button
                          onClick={() => removeSubwork(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Subwork Name</label>
                          <input
                            type="text"
                            value={sw.subwork_name}
                            onChange={(e) => updateSubwork(index, 'subwork_name', e.target.value)}
                            disabled={sw.is_from_estimate}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            value={sw.estimated_amount}
                            onChange={(e) => updateSubwork(index, 'estimated_amount', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <textarea
                            value={sw.subwork_description}
                            onChange={(e) => updateSubwork(index, 'subwork_description', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {subworks.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No subworks added yet. Add subworks manually or fetch from estimate.
                    </div>
                  )}
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={saveSubworks}
                    disabled={loading}
                    className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {loading ? 'Saving...' : 'Save & Complete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkManagement;
