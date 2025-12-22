import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Plus, Save, Send, Calculator, Edit2, Trash2, Eye, ChevronDown, ChevronUp } from 'lucide-react';

interface MeasurementEntryProps {
  onNavigate: (page: string) => void;
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
}

interface BOQItem {
  id: string;
  item_number: string;
  description: string;
  unit: string;
  boq_quantity: number;
  rate: number;
  amount: number;
  executed_quantity: number;
  executed_amount: number;
  balance_quantity: number;
  is_clause_38_applicable: boolean;
  excess_percentage: number;
}

interface Measurement {
  id: string;
  measurement_number: string;
  measurement_date: string;
  description: string;
  length: number;
  breadth: number;
  height: number;
  quantity: number;
  rate: number;
  amount: number;
  status: string;
  remarks: string;
  created_at: string;
}

interface MeasurementFormData {
  project_id: string;
  boq_item_id: string;
  measurement_number: string;
  measurement_date: string;
  description: string;
  length: number;
  breadth: number;
  height: number;
  quantity: number;
  rate: number;
  remarks: string;
}

const MeasurementEntry: React.FC<MeasurementEntryProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [selectedBoqItem, setSelectedBoqItem] = useState<BOQItem | null>(null);
  const [measurementsByItem, setMeasurementsByItem] = useState<Record<string, Measurement[]>>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showItemSelector, setShowItemSelector] = useState(false);

  const [formData, setFormData] = useState<MeasurementFormData>({
    project_id: '',
    boq_item_id: '',
    measurement_number: '',
    measurement_date: new Date().toISOString().split('T')[0],
    description: '',
    length: 0,
    breadth: 0,
    height: 0,
    quantity: 0,
    rate: 0,
    remarks: ''
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchBOQItems(selectedProject);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (formData.length && formData.breadth && formData.height) {
      const calculatedQty = formData.length * formData.breadth * formData.height;
      setFormData(prev => ({ ...prev, quantity: calculatedQty }));
    }
  }, [formData.length, formData.breadth, formData.height]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('mb_projects')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchBOQItems = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('mb_boq_items')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;

      const sortedItems = (data || []).sort((a, b) => {
        const numA = parseFloat(a.item_number) || 0;
        const numB = parseFloat(b.item_number) || 0;
        return numA - numB;
      });

      setBoqItems(sortedItems);
    } catch (error) {
      console.error('Error fetching BOQ items:', error);
    }
  };

  const fetchMeasurements = async (boqItemId: string) => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('mb_measurements')
        .select('*')
        .eq('boq_item_id', boqItemId)
        .order('measurement_date', { ascending: false });

      if (error) throw error;
      setMeasurementsByItem(prev => ({
        ...prev,
        [boqItemId]: data || []
      }));
    } catch (error) {
      console.error('Error fetching measurements:', error);
    }
  };

  const toggleItemExpand = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
      if (selectedBoqItem?.id === itemId) {
        setSelectedBoqItem(null);
        setShowAddForm(false);
      }
    } else {
      newExpanded.add(itemId);
      const item = boqItems.find(i => i.id === itemId);
      if (item) {
        setSelectedBoqItem(item);
        fetchMeasurements(itemId);
      }
    }
    setExpandedItems(newExpanded);
  };

  const handleAddMeasurement = (item: BOQItem) => {
    setSelectedBoqItem(item);
    setFormData(prev => ({
      ...prev,
      project_id: selectedProject,
      boq_item_id: item.id,
      rate: item.rate
    }));
    setShowAddForm(true);
  };

  const handleSave = async (status: 'draft' | 'submitted') => {
    if (!user) return;

    setError('');
    setSuccess('');

    if (!formData.project_id || !formData.boq_item_id) {
      setError('Please select project and BOQ item');
      return;
    }

    if (formData.quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    if (selectedBoqItem && status === 'submitted') {
      const currentExecuted = selectedBoqItem.executed_quantity || 0;
      const newTotal = currentExecuted + formData.quantity;
      const excessPercentage = ((newTotal - selectedBoqItem.boq_quantity) / selectedBoqItem.boq_quantity) * 100;

      console.log('Clause 38 Check:', {
        boqQuantity: selectedBoqItem.boq_quantity,
        currentExecuted,
        newMeasurement: formData.quantity,
        newTotal,
        excessPercentage
      });

      if (excessPercentage >= 25) {
        const confirmed = window.confirm(
          `⚠️ CLAUSE 38 WARNING ⚠️\n\n` +
          `This measurement will exceed the BOQ quantity by ${excessPercentage.toFixed(2)}%.\n\n` +
          `BOQ Quantity: ${selectedBoqItem.boq_quantity.toFixed(3)} ${selectedBoqItem.unit}\n` +
          `Current Executed: ${currentExecuted.toFixed(3)} ${selectedBoqItem.unit}\n` +
          `New Measurement: ${formData.quantity.toFixed(3)} ${selectedBoqItem.unit}\n` +
          `Total after this: ${newTotal.toFixed(3)} ${selectedBoqItem.unit}\n\n` +
          `⚠️ This will be marked as Clause 38 (excess > 25%).\n\n` +
          `Do you want to proceed with this measurement?`
        );

        if (!confirmed) {
          setLoading(false);
          return;
        }

        console.log('User confirmed Clause 38 measurement, proceeding...');
      }
    }

    try {
      setLoading(true);

      const { data: existingMeasurements } = await supabase
        .schema('estimate')
        .from('mb_measurements')
        .select('measurement_number')
        .eq('project_id', formData.project_id)
        .order('measurement_number', { ascending: false })
        .limit(1);

      let measurementNumber = formData.measurement_number;
      if (!measurementNumber) {
        const lastNumber = existingMeasurements && existingMeasurements.length > 0
          ? parseInt(existingMeasurements[0].measurement_number.split('-').pop() || '0')
          : 0;
        measurementNumber = `MB-${String(lastNumber + 1).padStart(4, '0')}`;
      }

      const { error: insertError } = await supabase
        .schema('estimate')
        .from('mb_measurements')
        .insert({
          project_id: formData.project_id,
          boq_item_id: formData.boq_item_id,
          measurement_number: measurementNumber,
          measurement_date: formData.measurement_date,
          description: formData.description,
          length: formData.length || null,
          breadth: formData.breadth || null,
          height: formData.height || null,
          quantity: formData.quantity,
          rate: formData.rate,
          remarks: formData.remarks || null,
          status,
          created_by: user.id,
          submitted_at: status === 'submitted' ? new Date().toISOString() : null
        });

      if (insertError) throw insertError;

      console.log('Measurement saved successfully:', measurementNumber);

      const currentExecuted = (selectedBoqItem?.executed_quantity || 0) + formData.quantity;
      const isClause38 = selectedBoqItem &&
        ((currentExecuted - selectedBoqItem.boq_quantity) / selectedBoqItem.boq_quantity) * 100 >= 25;

      await supabase
        .schema('estimate')
        .from('mb_audit_logs')
        .insert({
          project_id: formData.project_id,
          user_id: user.id,
          action: status === 'submitted' ? 'measurement_submitted' : 'measurement_saved',
          entity_type: 'measurement',
          details: {
            measurement_number: measurementNumber,
            boq_item: selectedBoqItem?.item_number,
            quantity: formData.quantity,
            is_clause_38: isClause38
          }
        });

      const successMsg = `Measurement ${status === 'submitted' ? 'submitted' : 'saved'} successfully` +
        (isClause38 ? ' (Clause 38 applicable)' : '');
      setSuccess(successMsg);
      console.log('Success:', successMsg);

      if (selectedBoqItem) {
        console.log('Refreshing measurements and BOQ items...');
        await fetchMeasurements(selectedBoqItem.id);
        await fetchBOQItems(selectedProject);
        console.log('Data refreshed');
      }

      resetForm();
      setShowAddForm(false);
    } catch (error) {
      console.error('Error saving measurement:', error);
      setError('Failed to save measurement');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      project_id: selectedProject,
      boq_item_id: selectedBoqItem?.id || '',
      measurement_number: '',
      measurement_date: new Date().toISOString().split('T')[0],
      description: '',
      length: 0,
      breadth: 0,
      height: 0,
      quantity: 0,
      rate: selectedBoqItem?.rate || 0,
      remarks: ''
    });
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      je_approved: 'bg-green-100 text-green-800',
      de_approved: 'bg-green-200 text-green-900',
      ee_approved: 'bg-green-300 text-green-950',
      rejected: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const filteredBoqItems = boqItems.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.item_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = activeFilters.size === 0 || Array.from(activeFilters).every(filter => {
      switch (filter) {
        case 'with_measurements':
          return (item.executed_quantity || 0) > 0;
        case 'clause_38':
          return item.is_clause_38_applicable === true;
        case 'balance_positive':
          return item.balance_quantity > 0;
        default:
          return true;
      }
    });

    const matchesSelection = selectedItems.size === 0 || selectedItems.has(item.id);

    return matchesSearch && matchesFilter && matchesSelection;
  });

  const toggleFilter = (filter: string) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(filter)) {
      newFilters.delete(filter);
    } else {
      newFilters.add(filter);
    }
    setActiveFilters(newFilters);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === boqItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(boqItems.map(item => item.id)));
    }
  };

  const toggleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
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
          <h1 className="text-3xl font-bold text-gray-900">Measurement Entry</h1>
          <p className="text-gray-600 mt-2">Select BOQ items and record measurements</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Project *
          </label>
          <select
            value={selectedProject}
            onChange={(e) => {
              setSelectedProject(e.target.value);
              setBoqItems([]);
              setSelectedBoqItem(null);
              setMeasurementsByItem({});
              setExpandedItems(new Set());
              setShowAddForm(false);
              setSearchQuery('');
              setActiveFilters(new Set());
              setSelectedItems(new Set());
              setShowItemSelector(false);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select Project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.project_code} - {project.project_name}
              </option>
            ))}
          </select>
        </div>

        {selectedProject && boqItems.length > 0 && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  BOQ Items ({filteredBoqItems.length} of {boqItems.length})
                </h2>
                <button
                  onClick={() => setShowItemSelector(!showItemSelector)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center"
                >
                  {showItemSelector ? 'Hide' : 'Show'} Item Selection
                </button>
              </div>

              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Items
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by item number or description..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Filter By ({activeFilters.size} selected)
                    </label>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setActiveFilters(new Set(['with_measurements', 'clause_38', 'balance_positive']))}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setActiveFilters(new Set())}
                        className="text-xs text-gray-600 hover:text-gray-800"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-md p-3 space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={activeFilters.has('with_measurements')}
                        onChange={() => toggleFilter('with_measurements')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">With Measurements</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={activeFilters.has('clause_38')}
                        onChange={() => toggleFilter('clause_38')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Clause 38 Applicable</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={activeFilters.has('balance_positive')}
                        onChange={() => toggleFilter('balance_positive')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Positive Balance Only</span>
                    </label>
                  </div>
                </div>
              </div>

              {showItemSelector && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      Select Items to Display ({selectedItems.size} selected)
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={toggleSelectAll}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                      >
                        {selectedItems.size === boqItems.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <button
                        onClick={() => setSelectedItems(new Set())}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {boqItems.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => toggleSelectItem(item.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Item {item.item_number}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {filteredBoqItems.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-gray-500 mb-2">No items match your current filters.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilters(new Set());
                    setSelectedItems(new Set());
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <>
                {filteredBoqItems.map((item) => (
                  <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleItemExpand(item.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="font-semibold text-lg text-gray-900">Item {item.item_number}</span>
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">
                          {item.unit}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{item.description}</p>

                      {item.is_clause_38_applicable === true && (
                        <div className="mt-3 px-4 py-3 bg-orange-50 border border-orange-300 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <svg className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-orange-900">
                                Clause 38 Applicable - Quantity Exceeded by {(item.excess_percentage || 0).toFixed(2)}%
                              </p>
                              <p className="text-xs text-orange-700 mt-1">
                                Executed quantity exceeds BOQ quantity by more than 25%. This requires approval under Clause 38.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">BOQ Quantity</span>
                          <p className="font-semibold text-gray-900">{item.boq_quantity.toFixed(3)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">Rate</span>
                          <p className="font-semibold text-gray-900">₹{item.rate.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">Executed</span>
                          <p className="font-semibold text-green-600">{(item.executed_quantity || 0).toFixed(3)}</p>
                          <p className="text-xs text-green-700 mt-0.5">₹{(item.executed_amount || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">Balance</span>
                          <p className={`font-semibold ${item.balance_quantity < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                            {item.balance_quantity.toFixed(3)}
                          </p>
                          <p className={`text-xs mt-0.5 ${item.balance_quantity < 0 ? 'text-red-700' : 'text-orange-700'}`}>
                            ₹{(item.balance_quantity * item.rate).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddMeasurement(item);
                          if (!expandedItems.has(item.id)) {
                            toggleItemExpand(item.id);
                          }
                        }}
                        className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </button>
                      {expandedItems.has(item.id) ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedItems.has(item.id) && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    {showAddForm && selectedBoqItem?.id === item.id && (
                      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Measurement</h3>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Measurement Date *
                              </label>
                              <input
                                type="date"
                                value={formData.measurement_date}
                                onChange={(e) => setFormData({ ...formData, measurement_date: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                              </label>
                              <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Measurement description"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Length (m)
                              </label>
                              <input
                                type="number"
                                step="0.001"
                                value={formData.length}
                                onChange={(e) => setFormData({ ...formData, length: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Breadth (m)
                              </label>
                              <input
                                type="number"
                                step="0.001"
                                value={formData.breadth}
                                onChange={(e) => setFormData({ ...formData, breadth: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Height/Depth (m)
                              </label>
                              <input
                                type="number"
                                step="0.001"
                                value={formData.height}
                                onChange={(e) => setFormData({ ...formData, height: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Quantity * ({selectedBoqItem?.unit || 'Unit'})
                              </label>
                              <input
                                type="number"
                                step="0.001"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Amount
                              </label>
                              <div className="text-xl font-bold text-green-600 mt-2">
                                ₹{(formData.quantity * formData.rate).toFixed(2)}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Remarks
                            </label>
                            <textarea
                              value={formData.remarks}
                              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Additional remarks..."
                            />
                          </div>

                          <div className="flex justify-end space-x-3 pt-4 border-t">
                            <button
                              onClick={() => {
                                setShowAddForm(false);
                                resetForm();
                              }}
                              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSave('draft')}
                              disabled={loading}
                              className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              Save as Draft
                            </button>
                            <button
                              onClick={() => handleSave('submitted')}
                              disabled={loading}
                              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Submit for Approval
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      {(() => {
                        const itemMeasurements = measurementsByItem[item.id] || [];
                        return (
                          <>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">
                              Measurement Entries ({itemMeasurements.length})
                            </h4>

                            {itemMeasurements.length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                No measurements recorded yet. Click "Add" to create a new measurement entry.
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">MB No.</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">L</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">B</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">H</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {itemMeasurements.map((measurement) => (
                                      <tr key={measurement.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-sm text-gray-900 font-medium">{measurement.measurement_number}</td>
                                        <td className="px-3 py-2 text-sm text-gray-600">
                                          {new Date(measurement.measurement_date).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-gray-600 max-w-xs truncate">
                                          {measurement.description || '-'}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-right text-gray-900">
                                          {measurement.length ? measurement.length.toFixed(3) : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-right text-gray-900">
                                          {measurement.breadth ? measurement.breadth.toFixed(3) : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-right text-gray-900">
                                          {measurement.height ? measurement.height.toFixed(3) : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-right font-medium text-gray-900">
                                          {measurement.quantity.toFixed(3)}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-right font-medium text-green-600">
                                          ₹{measurement.amount.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 text-sm">
                                          {getStatusBadge(measurement.status)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-gray-50">
                                    <tr>
                                      <td colSpan={6} className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">
                                        Total:
                                      </td>
                                      <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                                        {itemMeasurements.reduce((sum, m) => sum + m.quantity, 0).toFixed(3)}
                                      </td>
                                      <td className="px-3 py-2 text-sm font-bold text-green-600 text-right">
                                        ₹{itemMeasurements.reduce((sum, m) => sum + m.amount, 0).toFixed(2)}
                                      </td>
                                      <td></td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
                ))}
              </>
            )}
          </div>
        )}

        {selectedProject && boqItems.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No BOQ items found for this project. Please upload BOQ first.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeasurementEntry;
