import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, X, FileText } from 'lucide-react';

interface LeadStatementProps {
  worksId: string;
  workName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface LeadStatementItem {
  id: string;
  works_id: string;
  sr_no: number;
  material: string;
  reference: string;
  lead_in_km: number;
  lead_charges: number;
  total_rate: number;
  unit: string;
  created_at: string;
  created_by: string;
}

const LeadStatement: React.FC<LeadStatementProps> = ({
  worksId,
  workName,
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [leadItems, setLeadItems] = useState<LeadStatementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LeadStatementItem | null>(null);
  const [formData, setFormData] = useState({
    material: '',
    reference: '',
    lead_in_km: 0,
    lead_charges: 0,
    total_rate: 0,
    unit: ''
  });

  useEffect(() => {
    if (isOpen && worksId) {
      fetchLeadStatements();
    }
  }, [isOpen, worksId]);

  const fetchLeadStatements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('lead_statements')
        .select('*')
        .eq('works_id', worksId)
        .order('sr_no', { ascending: true });

      if (error) throw error;
      setLeadItems(data || []);
    } catch (error) {
      console.error('Error fetching lead statements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNextSrNo = async (): Promise<number> => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('lead_statements')
        .select('sr_no')
        .eq('works_id', worksId)
        .order('sr_no', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? data[0].sr_no + 1 : 1;
    } catch (error) {
      console.error('Error getting next sr_no:', error);
      return 1;
    }
  };

  const handleAdd = async () => {
    if (!formData.material || !user) return;

    try {
      const nextSrNo = await getNextSrNo();

      const { error } = await supabase
        .schema('estimate')
        .from('lead_statements')
        .insert([{
          works_id: worksId,
          sr_no: nextSrNo,
          material: formData.material,
          reference: formData.reference,
          lead_in_km: formData.lead_in_km,
          lead_charges: formData.lead_charges,
          total_rate: formData.total_rate,
          unit: formData.unit,
          created_by: user.id
        }]);

      if (error) throw error;

      setShowAddModal(false);
      resetForm();
      fetchLeadStatements();
    } catch (error) {
      console.error('Error adding lead statement:', error);
    }
  };

  const handleEdit = (item: LeadStatementItem) => {
    setSelectedItem(item);
    setFormData({
      material: item.material,
      reference: item.reference,
      lead_in_km: item.lead_in_km,
      lead_charges: item.lead_charges,
      total_rate: item.total_rate,
      unit: item.unit
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!formData.material || !selectedItem) return;

    try {
      const { error } = await supabase
        .schema('estimate')
        .from('lead_statements')
        .update({
          material: formData.material,
          reference: formData.reference,
          lead_in_km: formData.lead_in_km,
          lead_charges: formData.lead_charges,
          total_rate: formData.total_rate,
          unit: formData.unit,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedItem.id);

      if (error) throw error;

      setShowEditModal(false);
      setSelectedItem(null);
      resetForm();
      fetchLeadStatements();
    } catch (error) {
      console.error('Error updating lead statement:', error);
    }
  };

  const handleDelete = async (item: LeadStatementItem) => {
    if (!confirm('Are you sure you want to delete this lead statement item?')) {
      return;
    }

    try {
      const { error } = await supabase
        .schema('estimate')
        .from('lead_statements')
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      fetchLeadStatements();
    } catch (error) {
      console.error('Error deleting lead statement:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      material: '',
      reference: '',
      lead_in_km: 0,
      lead_charges: 0,
      total_rate: 0,
      unit: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 uppercase text-center">
                LEAD STATEMENT
              </h3>
              <p className="text-sm text-gray-700 mt-1">
                Name Of Work: <span className="font-medium">{workName}</span>
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Item
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading lead statements...</p>
              </div>
            ) : leadItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300">
                        Sr. No.
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300">
                        Material
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300">
                        Reference
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300">
                        Lead in Km.
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300">
                        Lead Charges
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300">
                        Total Rate
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300">
                        Unit
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leadItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-center text-gray-900 border border-gray-300">
                          {item.sr_no}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 border border-gray-300">
                          {item.material}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 border border-gray-300">
                          {item.reference || '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900 border border-gray-300">
                          {item.lead_in_km.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900 border border-gray-300">
                          {item.lead_charges.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 border border-gray-300">
                          {item.total_rate.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-center text-gray-900 border border-gray-300">
                          {item.unit || '-'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center border border-gray-300">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-green-600 hover:text-green-900 p-1 rounded"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="text-red-600 hover:text-red-900 p-1 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No lead statements found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add lead charges for materials used in this work.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => {
                      resetForm();
                      setShowAddModal(true);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Item
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {showEditModal ? 'Edit Lead Statement Item' : 'Add Lead Statement Item'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setSelectedItem(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Material *
                  </label>
                  <input
                    type="text"
                    value={formData.material}
                    onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Cement, Steel, Sand, 80mm Metal"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference
                  </label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Chandrapur, Andhari River, Tembhurda"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lead in Km.
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.lead_in_km}
                      onChange={(e) => setFormData({ ...formData, lead_in_km: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lead Charges
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.lead_charges}
                      onChange={(e) => setFormData({ ...formData, lead_charges: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Rate
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.total_rate}
                      onChange={(e) => setFormData({ ...formData, total_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., /Bag, /M.T., /Cum"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setSelectedItem(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={showEditModal ? handleUpdate : handleAdd}
                  disabled={!formData.material}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {showEditModal ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadStatement;
