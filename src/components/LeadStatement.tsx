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
  material_type?: string;
  reference: string;
  lead_in_km: number;
  lead_charges: number;
  total_rate: number;
  unit: string;
  unit_from_lead_chart?: string;
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
    material_type: '',
    reference: '',
    lead_in_km: 0,
    lead_charges: 0,
    total_rate: 0,
    unit: '',
    unit_from_lead_chart: ''
  });

  const [materialOptions, setMaterialOptions] = useState<{ name: string; rate: string; unit: string }[]>([]);
  const [showMaterialOptions, setShowMaterialOptions] = useState(false);
  const [searchingLeadCharges, setSearchingLeadCharges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const searchLeadCharges = async (leadKm: number) => {
    if (leadKm <= 0) {
      setMaterialOptions([]);
      setShowMaterialOptions(false);
      return;
    }

    try {
      setSearchingLeadCharges(true);

      let data = null;
      let error = null;

      const result1 = await supabase
        .schema('estimate')
        .from('Lead_Charges_Materials_22-23')
        .select('*')
        .eq('Lead in KM', leadKm.toFixed(2))
        .maybeSingle();

      if (result1.data) {
        data = result1.data;
      } else {
        const result2 = await supabase
          .schema('estimate')
          .from('Lead_Charges_Materials_22-23')
          .select('*')
          .eq('Lead in KM', leadKm.toString())
          .maybeSingle();

        if (result2.data) {
          data = result2.data;
        } else {
          const result3 = await supabase
            .schema('estimate')
            .from('Lead_Charges_Materials_22-23')
            .select('*')
            .eq('KM', leadKm.toFixed(2))
            .maybeSingle();

          if (result3.data) {
            data = result3.data;
          } else {
            const result4 = await supabase
              .schema('estimate')
              .from('Lead_Charges_Materials_22-23')
              .select('*')
              .eq('KM', leadKm.toString())
              .maybeSingle();

            data = result4.data;
            error = result4.error;
          }
        }
      }

      if (error) throw error;

      if (data) {
        const options: { name: string; rate: string; unit: string }[] = [];

        const materialColumns = [
          { key: 'Murrum, Building Rubish, Earth', unit: 'cum' },
          { key: 'Manure  Sludge', unit: 'cum' },
          { key: 'Excavated Rock soling stone', unit: 'cum' },
          { key: 'Sand, Stone below 40 mm, Normal Brick sider aggre. Timber', unit: 'cum' },
          { key: 'Stone aggregate 40mm Normal size and above', unit: 'cum' },
          { key: 'ConcreteBlock (FORM)', unit: 'cum' },
          { key: 'Cement, Lime, Stone Block, GI, CI, CC & AC Pipes / Sheet& Plate', unit: 'MT' },
          { key: 'Bricks', unit: '1000/unit' },
          { key: 'Tiles Half Round Tiles /Roofing Tiles/Manlore Tiles', unit: '1000/unit' },
          { key: 'Steel (MS, TMT, H.Y.S.D.) Structural Steel', unit: 'MT' },
          { key: 'Flooring Tiles Ceramic/ Marbonate', unit: 'sqm' },
          { key: 'Asphalt in Drum', unit: 'MT' }
        ];

        materialColumns.forEach(col => {
          const rate = data[col.key];
          if (rate && rate !== '' && !isNaN(parseFloat(rate))) {
            options.push({
              name: col.key,
              rate: rate,
              unit: col.unit
            });
          }
        });

        setMaterialOptions(options);
        setShowMaterialOptions(options.length > 0);
      } else {
        setMaterialOptions([]);
        setShowMaterialOptions(false);
      }
    } catch (error) {
      console.error('Error searching lead charges:', error);
      setMaterialOptions([]);
      setShowMaterialOptions(false);
    } finally {
      setSearchingLeadCharges(false);
    }
  };

  const handleLeadKmChange = (value: number) => {
    setFormData({ ...formData, lead_in_km: value });
    searchLeadCharges(value);
  };

  const selectMaterialOption = (option: { name: string; rate: string; unit: string }) => {
    const rate = parseFloat(option.rate);
    let totalRate = rate;
    let editableUnit = option.unit.toUpperCase();

    // Special conversion for Cement, Lime, etc. - convert from metric ton to per bag
    if (option.name.includes('Cement, Lime, Stone Block, GI, CI, CC & AC Pipes / Sheet& Plate')) {
      totalRate = parseFloat((rate / 20).toFixed(2));
      editableUnit = '/BAG';
    }
    // Special conversion for Bricks - convert from per 1000 to per unit (NOS)
    else if (option.name.toLowerCase().includes('bricks')) {
      totalRate = parseFloat((rate / 1000).toFixed(2));
      editableUnit = 'NOS';
    }

    setFormData({
      ...formData,
      material_type: option.name,
      lead_charges: rate,
      total_rate: totalRate,
      unit_from_lead_chart: option.unit, // Store the original unit from lead chart
      unit: editableUnit // Converted/uppercase unit for editing
    });
    setShowMaterialOptions(false);
  };

  const handleAdd = async () => {
    if (!formData.material || !user) {
      setError('Material is required and you must be logged in.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const nextSrNo = await getNextSrNo();

      const { error: insertError } = await supabase
        .schema('estimate')
        .from('lead_statements')
        .insert([{
          works_id: worksId,
          sr_no: nextSrNo,
          material: formData.material,
          material_type: formData.material_type,
          reference: formData.reference,
          lead_in_km: formData.lead_in_km,
          lead_charges: formData.lead_charges,
          unit_from_lead_chart: formData.unit_from_lead_chart,
          total_rate: formData.total_rate,
          unit: formData.unit,
          created_by: user.id
        }]);

      if (insertError) {
        console.error('Database error:', insertError);
        throw new Error(`Failed to add lead statement: ${insertError.message}`);
      }

      setShowAddModal(false);
      resetForm();
      fetchLeadStatements();
    } catch (error: any) {
      console.error('Error adding lead statement:', error);
      setError(error.message || 'Failed to add lead statement. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: LeadStatementItem) => {
    setSelectedItem(item);
    setFormData({
      material: item.material,
      material_type: item.material_type || '',
      reference: item.reference,
      lead_in_km: item.lead_in_km,
      lead_charges: item.lead_charges,
      unit_from_lead_chart: item.unit_from_lead_chart || '',
      total_rate: item.total_rate,
      unit: item.unit
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!formData.material || !selectedItem) {
      setError('Material is required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const { error: updateError } = await supabase
        .schema('estimate')
        .from('lead_statements')
        .update({
          material: formData.material,
          material_type: formData.material_type,
          reference: formData.reference,
          lead_in_km: formData.lead_in_km,
          lead_charges: formData.lead_charges,
          unit_from_lead_chart: formData.unit_from_lead_chart,
          total_rate: formData.total_rate,
          unit: formData.unit,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedItem.id);

      if (updateError) {
        console.error('Database error:', updateError);
        throw new Error(`Failed to update lead statement: ${updateError.message}`);
      }

      setShowEditModal(false);
      setSelectedItem(null);
      resetForm();
      fetchLeadStatements();
    } catch (error: any) {
      console.error('Error updating lead statement:', error);
      setError(error.message || 'Failed to update lead statement. Please try again.');
    } finally {
      setSaving(false);
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
      material_type: '',
      reference: '',
      lead_in_km: 0,
      lead_charges: 0,
      total_rate: 0,
      unit: '',
      unit_from_lead_chart: ''
    });
    setMaterialOptions([]);
    setShowMaterialOptions(false);
    setError(null);
    setSaving(false);
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
                        Material Type
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300">
                        Reference
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300">
                        Lead in Km.
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300">
                        Lead Charges<br />
                        <span className="text-[10px] font-normal normal-case text-gray-500">(From Search)</span>
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300 bg-green-50">
                        Unit (leadchart)<br />
                        <span className="text-[10px] font-normal normal-case text-green-600">(From Search)</span>
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300 bg-blue-50">
                        Total Rate<br />
                        <span className="text-[10px] font-normal normal-case text-blue-600">(Editable)</span>
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300 bg-blue-50">
                        Unit<br />
                        <span className="text-[10px] font-normal normal-case text-blue-600">(Editable)</span>
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
                        <td className="px-4 py-2 text-sm text-gray-600 border border-gray-300">
                          {item.material_type || '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 border border-gray-300">
                          {item.reference || '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900 border border-gray-300">
                          {item.lead_in_km.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-600 border border-gray-300">
                          {item.lead_charges.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-center font-medium text-green-800 border border-gray-300 bg-green-50">
                          {item.unit_from_lead_chart || '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-semibold text-blue-900 border border-gray-300 bg-blue-50">
                          {item.total_rate.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-center font-medium text-gray-900 border border-gray-300 bg-blue-50">
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[60]">
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

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
                  <span className="block sm:inline">{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Material *
                  </label>
                  <select
                    value={formData.material}
                    onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select Material</option>
                    <option value="80 mm (H.B Metal)">80 mm (H.B Metal)</option>
                    <option value="C.B. Metal (Above 40 mm)">C.B. Metal (Above 40 mm)</option>
                    <option value="C.B. Metal (Below 40 mm)">C.B. Metal (Below 40 mm)</option>
                    <option value="Sand">Sand</option>
                    <option value="Murrum">Murrum</option>
                    <option value="Steel">Steel</option>
                    <option value="Bricks">Bricks</option>
                    <option value="Tiles">Tiles</option>
                    <option value="Paving Blocks">Paving Blocks</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Material Type {showMaterialOptions && <span className="text-xs text-blue-600">(Select from search results below)</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.material_type}
                    onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder={showMaterialOptions ? "Select a material type from search results below" : "Enter material type or search by Lead in Km"}
                    readOnly={showMaterialOptions}
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
                      Lead in Km. *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.lead_in_km}
                      onChange={(e) => handleLeadKmChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 0.50, 1.00, 1.50"
                    />
                    {searchingLeadCharges && (
                      <p className="text-xs text-gray-500 mt-1">Searching lead charges...</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lead Charges {showMaterialOptions && <span className="text-xs text-blue-600">(From search)</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.lead_charges}
                      onChange={(e) => {
                        const charges = parseFloat(e.target.value) || 0;
                        setFormData({ ...formData, lead_charges: charges });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                      readOnly={showMaterialOptions}
                    />
                  </div>
                </div>

                {showMaterialOptions && materialOptions.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <label className="block text-sm font-medium text-blue-800 mb-2">
                      Select Material Type (Lead Charges for {formData.lead_in_km.toFixed(2)} KM):
                    </label>
                    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                      {materialOptions.map((option, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => selectMaterialOption(option)}
                          className="text-left px-3 py-2 bg-white border border-blue-300 rounded-md hover:bg-blue-100 hover:border-blue-400 transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-900">{option.name}</span>
                            <div className="text-right">
                              <span className="text-sm font-bold text-green-600">₹{parseFloat(option.rate).toFixed(2)}</span>
                              <span className="text-xs text-gray-500 ml-2">/{option.unit}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 mt-2">Click on a material type to auto-fill Material Type, Lead Charges, and Unit</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Rate * <span className="text-xs text-gray-500">(Editable - used for calculations)</span>
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
                      Unit * <span className="text-xs text-gray-500">(Editable)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., CUM, MT, SQM"
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
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={showEditModal ? handleUpdate : handleAdd}
                  disabled={!formData.material || saving}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : (showEditModal ? 'Update' : 'Add')}
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
