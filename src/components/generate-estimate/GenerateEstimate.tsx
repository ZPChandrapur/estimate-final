import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Work, EstimateTemplate, SubWork, SubworkItem, ItemMeasurement, ItemLead, ItemMaterial, RecapCalculations, TaxEntry } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import { EstimatePDFGenerator } from './EstimatePDFGenerator';
import { 
  FileText, 
  Download, 
  Search,
  Filter,
  Calendar,
  Building,
  IndianRupee,
  Eye,
  Printer,
  Save,
  Copy,
  Trash2,
  Plus,
  BookOpen
} from 'lucide-react';

const GenerateEstimate: React.FC = () => {
  const { user } = useAuth();
  const [works, setWorks] = useState<Work[]>([]);
  const [templates, setTemplates] = useState<EstimateTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showPDFGenerator, setShowPDFGenerator] = useState(false);
  const [selectedWorkForPDF, setSelectedWorkForPDF] = useState<string>('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [selectedWorkForTemplate, setSelectedWorkForTemplate] = useState<Work | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savedCalculations, setSavedCalculations] = useState<{ [workId: string]: { calculations: RecapCalculations; taxes: TaxEntry[] } }>({});

  useEffect(() => {
    fetchWorks();
    fetchTemplates();
  }, []);

// ✅ Optimized: Fetch only necessary work fields
const fetchWorks = async () => {
  try {
    setLoading(true);
    const { data, error } = await supabase
      .schema('estimate')
      .from('works')
      .select('sr_no, works_id, work_name, division, type, status, created_at, total_estimated_cost, village, grampanchayat, taluka')
      .order('sr_no', { ascending: false });

    if (error) throw error;
    setWorks(data || []);
  } catch (error) {
    console.error('Error fetching works:', error);
  } finally {
    setLoading(false);
  }
};


  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('estimate_templates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

 // ✅ Optimized: Fetch complete estimate data (batched, minimal queries)
const fetchCompleteEstimateData = async (worksId: string) => {
  try {
    // 1️⃣ Fetch main work details
    const { data: work, error: workError} = await supabase
      .schema('estimate')
      .from('works')
      .select('works_id, work_name, type, division, sub_division, major_head, minor_head, service_head, departmental_head, fund_head, sanctioning_authority, ssr, total_estimated_cost, village, grampanchayat, taluka')
      .eq('works_id', worksId)
      .single();

    if (workError || !work) throw workError;

    // 2️⃣ Fetch subworks
    const { data: subworks, error: subworksError } = await supabase
      .schema('estimate')
      .from('subworks')
      .select('subworks_id, subworks_name, works_id')
      .eq('works_id', worksId)
      .order('sr_no');

    if (subworksError) throw subworksError;

    // 3️⃣ Fetch all subwork items in one batch
    const subworkIds = (subworks || []).map(sw => sw.subworks_id);
    const { data: allItems, error: itemsError } = await supabase
      .schema('estimate')
      .from('subwork_items')
      .select('sr_no, subwork_id, item_number, description_of_item, ssr_quantity, ssr_rate, ssr_unit, total_item_amount')
      .in('subwork_id', subworkIds);

    if (itemsError) throw itemsError;

    const subworkItems: Record<string, SubworkItem[]> = {};
    (subworks || []).forEach(sw => {
      subworkItems[sw.subworks_id] = (allItems || []).filter(it => it.subwork_id === sw.subworks_id);
    });

    // 4️⃣ Fetch all measurements in one query
    const itemSrNos = (allItems || []).map(it => it.sr_no);
    const { data: allMeasurements, error: measureError } = await supabase
      .schema('estimate')
      .from('item_measurements')
      .select('sr_no, subwork_item_id, description_of_items, no_of_units, length, width_breadth, height_depth, calculated_quantity, unit')
      .in('subwork_item_id', itemSrNos);

    if (measureError) throw measureError;

    const measurements: Record<string, ItemMeasurement[]> = {};
    (allItems || []).forEach(it => {
      measurements[it.sr_no] = (allMeasurements || []).filter(m => m.subwork_item_id === it.sr_no);
    });

    return {
      work,
      subworks: subworks || [],
      subworkItems,
      measurements,
      leads: {},
      materials: {},
    };
  } catch (error) {
    console.error('Error fetching complete estimate data:', error);
    return null;
  }
};

  const handleSaveAsTemplate = async (work: Work) => {
    setSelectedWorkForTemplate(work);
    setTemplateName(`${work.work_name} Template`);
    setTemplateDescription(`Template based on ${work.works_id}`);
    setShowSaveTemplate(true);
  };

  const saveTemplate = async () => {
    if (!selectedWorkForTemplate || !templateName.trim() || !user) return;

    // Check if user already has 10 templates
    if (templates.length >= 10) {
      alert('You can only save up to 10 templates. Please delete some templates first.');
      return;
    }

    try {
      setSavingTemplate(true);

      // Fetch complete estimate data
      const completeData = await fetchCompleteEstimateData(selectedWorkForTemplate.works_id);
      if (!completeData) {
        alert('Error fetching estimate data');
        return;
      }

      // Save template
      const { error } = await supabase
        .schema('estimate')
        .from('estimate_templates')
        .insert([{
          template_name: templateName.trim(),
          description: templateDescription.trim() || null,
          original_works_id: selectedWorkForTemplate.works_id,
          template_data: completeData,
          created_by: user.id
        }]);

      if (error) throw error;

      alert('Template saved successfully!');
      setShowSaveTemplate(false);
      setSelectedWorkForTemplate(null);
      setTemplateName('');
      setTemplateDescription('');
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error saving template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const generateNewWorksId = async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('works')
        .select('works_id, sr_no')
        .order('works_id', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastWorksId = data[0].works_id;
        const match = lastWorksId.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      return `WORK-${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating works ID:', error);
      return `WORK-${Date.now()}`;
    }
  };

  const createEstimateFromTemplate = async (template: EstimateTemplate) => {
    if (!user) return;

    try {
      setCreatingFromTemplate(true);

      const newWorksId = await generateNewWorksId();
      const templateData = template.template_data;

      // Create new work
      const newWork = {
        // Don't copy sr_no - let database auto-generate it
        works_id: newWorksId,
        work_name: `${templateData.work.work_name} (From Template)`,
        type: templateData.work.type,
        division: templateData.work.division,
        sub_division: templateData.work.sub_division,
        major_head: templateData.work.major_head,
        minor_head: templateData.work.minor_head,
        service_head: templateData.work.service_head,
        departmental_head: templateData.work.departmental_head,
        fund_head: templateData.work.fund_head,
        sanctioning_authority: templateData.work.sanctioning_authority,
        ssr: templateData.work.ssr,
        status: 'draft' as const,
        created_by: user.id,
        total_estimated_cost: 0 // Will be recalculated
      };

      const { data: createdWork, error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .insert([newWork])
        .select()
        .single();

      if (workError) throw workError;

      // Create subworks
      const subworkMapping: { [oldId: string]: string } = {};
      for (const subwork of templateData.subworks) {
        const newSubworkId = `${newWorksId}-${subwork.subworks_id.split('-').pop()}`;
        subworkMapping[subwork.subworks_id] = newSubworkId;

        const { error: subworkError } = await supabase
          .schema('estimate')
          .from('subworks')
          .insert([{
            // Don't copy sr_no - let database auto-generate it
            works_id: newWorksId,
            subworks_id: newSubworkId,
            subworks_name: subwork.subworks_name,
            created_by: user.id
          }]);

        if (subworkError) throw subworkError;

        // Create subwork items
        const items = templateData.subworkItems[subwork.subworks_id] || [];
        for (const item of items) {
          const { data: createdItem, error: itemError } = await supabase
            .schema('estimate')
            .from('subwork_items')
            .insert([{
              // Don't copy sr_no - let database auto-generate it
              subwork_id: newSubworkId,
              item_number: item.item_number,
              category: item.category,
              description_of_item: item.description_of_item,
              ssr_quantity: item.ssr_quantity,
              ssr_rate: item.ssr_rate,
              ssr_unit: item.ssr_unit,
              total_item_amount: item.total_item_amount,
              created_by: user.id
            }])
            .select()
            .single();

          if (itemError) throw itemError;

          // Create measurements
          const measurements = templateData.measurements[item.id] || [];
          for (const measurement of measurements) {
            const { error: measurementError } = await supabase
              .schema('estimate')
              .from('item_measurements')
              .insert([{
                subwork_item_id: createdItem.sr_no,
                measurement_sr_no: measurement.measurement_sr_no,
                description_of_items: measurement.description_of_items,
                no_of_units: measurement.no_of_units,
                length: measurement.length,
                width_breadth: measurement.width_breadth,
                height_depth: measurement.height_depth,
                calculated_quantity: measurement.calculated_quantity,
                unit: measurement.unit,
              }]);

            if (measurementError) throw measurementError;
          }

          // Create leads
          const leads = templateData.leads[item.id] || [];
          for (const lead of leads) {
            const { error: leadError } = await supabase
              .schema('estimate')
              .from('item_leads')
              .insert([{
                subwork_item_sr_no: createdItem.sr_no,
                material: lead.material,
                location_of_quarry: lead.location_of_quarry,
                lead_in_km: lead.lead_in_km,
                lead_charges: lead.lead_charges,
                initial_lead_charges: lead.initial_lead_charges,
                net_lead_charges: lead.net_lead_charges
              }]);

            if (leadError) throw leadError;
          }

          // Create materials
          const materials = templateData.materials[item.id] || [];
          for (const material of materials) {
            const { error: materialError } = await supabase
              .schema('estimate')
              .from('item_materials')
              .insert([{
                subwork_item_sr_no: createdItem.sr_no,
                material_name: material.material_name,
                required_quantity: material.required_quantity,
                unit: material.unit,
                rate_per_unit: material.rate_per_unit,
                total_material_cost: material.total_material_cost
              }]);

            if (materialError) throw materialError;
          }
        }
      }

      alert(`New estimate created successfully with Works ID: ${newWorksId}`);
      fetchWorks();
    } catch (error) {
      console.error('Error creating estimate from template:', error);
      alert('Error creating estimate from template');
    } finally {
      setCreatingFromTemplate(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .schema('estimate')
        .from('estimate_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      alert('Template deleted successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Error deleting template');
    }
  };
  const handleGeneratePDF = (work: Work) => {
    setSelectedWorkForPDF(work.works_id);
    setShowPDFGenerator(true);
  };

  const getTypeBadge = (type: string) => {
    const typeConfig = {
      'Technical Sanction': { bg: 'bg-gradient-to-r from-blue-100 to-indigo-200', text: 'text-blue-800', label: 'TS' },
      'Technical Approval': { bg: 'bg-gradient-to-r from-green-100 to-emerald-200', text: 'text-green-800', label: 'TA' },
    };

    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig['Technical Sanction'];

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text} shadow-lg`}>
        {config.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { bg: 'bg-gradient-to-r from-gray-100 to-slate-200', text: 'text-gray-800', label: 'Draft' },
      pending: { bg: 'bg-gradient-to-r from-amber-100 to-yellow-200', text: 'text-amber-800', label: 'Pending' },
      approved: { bg: 'bg-gradient-to-r from-green-100 to-emerald-200', text: 'text-green-800', label: 'Approved' },
      rejected: { bg: 'bg-gradient-to-r from-red-100 to-pink-200', text: 'text-red-800', label: 'Rejected' },
      in_progress: { bg: 'bg-gradient-to-r from-blue-100 to-indigo-200', text: 'text-blue-800', label: 'In Progress' },
      completed: { bg: 'bg-gradient-to-r from-purple-100 to-violet-200', text: 'text-purple-800', label: 'Completed' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text} shadow-lg`}>
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const filteredWorks = works.filter(work => {
    const matchesSearch = work.work_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (work.works_id && work.works_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (work.division && work.division.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || work.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || work.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return <LoadingSpinner text="Loading works..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
        <div className="px-8 py-6">
          <div className="flex items-center">
            <div className="p-3 bg-white/20 rounded-2xl mr-4 shadow-lg">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                Generate E-Estimate Reports
              </h1>
              <p className="text-violet-100 text-sm mt-1">Create professional PDF estimates for your construction projects</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-100 rounded-2xl shadow-lg border border-slate-200 p-6 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search works..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 text-sm border border-gray-300 rounded-xl leading-5 bg-white/80 backdrop-blur-sm placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 hover:bg-white transition-all duration-200 shadow-lg"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center space-x-2 max-w-xs">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block pl-3 pr-8 py-3 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 rounded-xl bg-white/80 backdrop-blur-sm hover:bg-white transition-all duration-200 shadow-lg"
            >
              <option value="all">All Types</option>
              <option value="Technical Approval">Technical Approval (TA)</option>
              <option value="Technical Sanction">Technical Sanction (TS)</option> 
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2 max-w-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block pl-3 pr-8 py-3 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 rounded-xl bg-white/80 backdrop-blur-sm hover:bg-white transition-all duration-200 shadow-lg"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        
        {/* Template Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-300">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Templates ({templates.length}/10)</span>
          </div>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all duration-200 shadow-lg"
          >
            <Eye className="w-4 h-4 mr-2" />
            {showTemplates ? 'Hide Templates' : 'View Templates'}
          </button>
        </div>
      </div>

      {/* Templates Section */}
      {showTemplates && (
        <div className="bg-gradient-to-br from-white to-slate-50 shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-white/20 rounded-lg mr-3">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-white">Saved Templates ({templates.length}/10)</h2>
              </div>
              {creatingFromTemplate && (
                <div className="flex items-center text-white">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating estimate...
                </div>
              )}
            </div>
          </div>

          {templates.length > 0 ? (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-2xl p-4 border border-emerald-200 hover:shadow-lg transition-all duration-300 hover:scale-105"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-sm font-bold text-emerald-900 truncate">
                        {template.template_name}
                      </h3>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-100 transition-all duration-200"
                        title="Delete Template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {template.description && (
                      <p className="text-xs text-emerald-700 mb-3 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    
                    <div className="text-xs text-emerald-600 mb-3">
                      <p>Original: {template.original_works_id}</p>
                      <p>Created: {new Date(template.created_at).toLocaleDateString('hi-IN')}</p>
                    </div>
                    
                    <button
                      onClick={() => createEstimateFromTemplate(template)}
                      disabled={creatingFromTemplate}
                      className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent rounded-xl shadow-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-300 transition-all duration-300 disabled:opacity-50"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Create New Estimate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-200 rounded-2xl flex items-center justify-center mb-4">
                <BookOpen className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No templates saved</h3>
              <p className="mt-1 text-sm text-gray-500">
                Save estimates as templates to reuse them later.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Works List for PDF Generation */}
      <div className="bg-gradient-to-br from-white to-slate-50 shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-violet-500 to-purple-600">
          <div className="flex items-center">
            <div className="p-2 bg-white/20 rounded-lg mr-3">
              <Printer className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-white">Select Work to Generate PDF Report</h2>
          </div>
        </div>

        {filteredWorks.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredWorks.map((work) => (
              <div
                key={work.sr_no}
                className="p-6 hover:bg-gradient-to-r hover:from-violet-50 hover:to-purple-50 transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-3">
                      <span className="text-sm font-bold text-gray-500">#{work.sr_no}</span>
                      {getTypeBadge(work.type)}
                      {getStatusBadge(work.status)}
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      {work.works_id} - {work.work_name}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Building className="w-4 h-4 mr-2 text-blue-500" />
                        <span>Division: {work.division || 'N/A'}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <IndianRupee className="w-4 h-4 mr-2 text-green-500" />
                        <span>Cost: {formatCurrency(work.total_estimated_cost)}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Calendar className="w-4 h-4 mr-2 text-purple-500" />
                        <span>Created: {new Date(work.created_at).toLocaleDateString('hi-IN')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="ml-6">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleSaveAsTemplate(work)}
                        disabled={templates.length >= 10}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-300 transition-all duration-300 disabled:opacity-50"
                        title={templates.length >= 10 ? "Maximum 10 templates allowed" : "Save as Template"}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Template
                      </button>
                      <button
                        onClick={() => handleGeneratePDF(work)}
                        className="inline-flex items-center px-6 py-3 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-violet-300 transition-all duration-300"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Generate PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-violet-100 to-purple-200 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
              <FileText className="h-12 w-12 text-violet-600" />
            </div>
            <h3 className="mt-2 text-lg font-bold text-gray-900">No works found</h3>
            <p className="mt-2 text-sm text-gray-500">
              No works match your current search and filter criteria.
            </p>
          </div>
        )}
      </div>

      {/* PDF Generator Modal */}
      {showPDFGenerator && (
        <EstimatePDFGenerator
          workId={selectedWorkForPDF}
          isOpen={showPDFGenerator}
          onClose={() => {
            setShowPDFGenerator(false);
            setSelectedWorkForPDF('');
          }}
          savedCalculations={savedCalculations[selectedWorkForPDF]?.calculations}
          savedTaxes={savedCalculations[selectedWorkForPDF]?.taxes}
        />
      )}

      {/* Save Template Modal */}
      {showSaveTemplate && selectedWorkForTemplate && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Save as Template</h3>
                <button
                  onClick={() => setShowSaveTemplate(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter template name"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter template description"
                    rows={3}
                    maxLength={500}
                  />
                </div>

                <div className="bg-emerald-50 p-3 rounded-md">
                  <p className="text-sm text-emerald-700">
                    <strong>Original Work:</strong> {selectedWorkForTemplate.works_id}
                  </p>
                  <p className="text-sm text-emerald-600 mt-1">
                    This will save the complete estimate including all subworks, items, measurements, leads, and materials.
                  </p>
                </div>

                <div className="text-xs text-gray-500">
                  Templates: {templates.length}/10 (Maximum 10 templates allowed)
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowSaveTemplate(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTemplate}
                  disabled={!templateName.trim() || savingTemplate}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingTemplate ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2 inline-block" />
                      Save Template
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateEstimate;
