import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Plus, Save, Send, Calculator } from 'lucide-react';

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
  executed_quantity: number;
  balance_quantity: number;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    if (formData.project_id) {
      fetchBOQItems(formData.project_id);
    }
  }, [formData.project_id]);

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
        .eq('project_id', projectId)
        .order('item_number');

      if (error) throw error;
      setBoqItems(data || []);
    } catch (error) {
      console.error('Error fetching BOQ items:', error);
    }
  };

  const handleBOQItemSelect = (itemId: string) => {
    const item = boqItems.find(i => i.id === itemId);
    if (item) {
      setSelectedBoqItem(item);
      setFormData(prev => ({
        ...prev,
        boq_item_id: itemId,
        rate: item.rate
      }));
    }
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
          ...formData,
          measurement_number: measurementNumber,
          status,
          created_by: user.id,
          submitted_at: status === 'submitted' ? new Date().toISOString() : null
        });

      if (insertError) throw insertError;

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
            quantity: formData.quantity
          }
        });

      setSuccess(`Measurement ${status === 'submitted' ? 'submitted' : 'saved'} successfully`);

      resetForm();
    } catch (error) {
      console.error('Error saving measurement:', error);
      setError('Failed to save measurement');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      project_id: formData.project_id,
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
    setSelectedBoqItem(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Measurement Entry</h1>
          <p className="text-gray-600 mt-2">Record measurements for BOQ items</p>
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

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project *
                </label>
                <select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value, boq_item_id: '' })}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  BOQ Item *
                </label>
                <select
                  value={formData.boq_item_id}
                  onChange={(e) => handleBOQItemSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={!formData.project_id}
                >
                  <option value="">Select BOQ Item</option>
                  {boqItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.item_number} - {item.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedBoqItem && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Selected BOQ Item Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-blue-700">Unit:</span>
                    <span className="font-medium text-blue-900 ml-2">{selectedBoqItem.unit}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">BOQ Qty:</span>
                    <span className="font-medium text-blue-900 ml-2">{selectedBoqItem.boq_quantity.toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Executed:</span>
                    <span className="font-medium text-green-700 ml-2">{selectedBoqItem.executed_quantity.toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Balance:</span>
                    <span className="font-medium text-orange-700 ml-2">{selectedBoqItem.balance_quantity.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            )}

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

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Calculator className="w-5 h-5 mr-2" />
                Measurements
              </h3>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                  readOnly
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <div className="text-2xl font-bold text-green-600">
                ₹{(formData.quantity * formData.rate).toFixed(2)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remarks
              </label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional remarks..."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t">
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
      </div>
    </div>
  );
};

export default MeasurementEntry;
