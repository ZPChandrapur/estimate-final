import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { SubworkItem, ItemMeasurement, ItemLead, ItemMaterial, ItemRate } from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  Calculator,
  Truck,
  Upload,
  X,
  ImageIcon,
  Package2,
  Check,
  X as CancelIcon
} from 'lucide-react';

interface RateAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  item: SubworkItem;
}

const HARDCODED_RATE = 1000;

const RateAnalysis: React.FC<RateAnalysisProps> = ({ isOpen, onClose, item }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'measurements' | 'leads' | 'materials'>('measurements');
  const [measurements, setMeasurements] = useState<ItemMeasurement[]>([]);
  const [itemRates, setItemRates] = useState<ItemRate[]>([]);
  const [leads, setLeads] = useState<ItemLead[]>([]);
  const [materials, setMaterials] = useState<ItemMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMeasurement, setSelectedMeasurement] = useState<ItemMeasurement | null>(null);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [designPhotos, setDesignPhotos] = useState<any[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [rateGroups, setRateGroups] = useState<{ [key: string]: { rate: number, quantity: number, description?: string } }>({});
  const [currentItem, setCurrentItem] = useState<SubworkItem>(item || {} as SubworkItem);
  const [selectedDescription, setSelectedDescription] = useState<string>('');
  const [newMeasurement, setNewMeasurement] = useState<Partial<ItemMeasurement>>({
    no_of_units: 0,
    length: 0,
    width_breadth: 0,
    height_depth: 0,
    is_manual_quantity: false,
    selected_rate_id: 0
  });
  const [selectedRate, setSelectedRate] = useState<number>(0);
  const [newLead, setNewLead] = useState<Partial<ItemLead>>({
    material: '',
    lead_in_km: 0,
    lead_charges: 0,
    initial_lead_charges: 0
  });
  const [newMaterial, setNewMaterial] = useState<Partial<ItemMaterial>>({
    material_name: '',
    required_quantity: 0,
    rate_per_unit: 0
  });
  const [newTax, setNewTax] = useState({ label: '', value: '', type: 'Addition' });
  const [entries, setEntries] = useState<
    { label: string; type: string; value: number; amount: number }
  >([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  // NEW STATE FOR INLINE ADDING + EDITING
  const [rowBeingAddedBelow, setRowBeingAddedBelow] = useState<number | null>(null);
  const [rowBeingEdited, setRowBeingEdited] = useState<number | null>(null);
  const [tempRow, setTempRow] = useState({ label: '', type: 'Addition', value: 0 });

  // NEW STATE FOR FINAL-RATE TAX
  const [showFinalTaxInput, setShowFinalTaxInput] = useState(false);
  const [finalTaxPercentInput, setFinalTaxPercentInput] = useState<number>(0);
  const [finalTaxApplied, setFinalTaxApplied] = useState<{ percent: number; amount: number } | null>(null);

  // Calculation helpers
  const calculateAmount = (type: string, rate: number, value: number) => {
    if (type === 'Tax') {
      return (rate * value) / 100;
    }
    if (type === 'Addition') {
      return value;
    }
    if (type === 'Deletion') {
      return -value;
    }
    return 0;
  };

  const summary = React.useMemo(() => {
    let additions = 0;
    let deletions = 0;
    let taxes = 0;
    let finalRate = HARDCODED_RATE;
    entries.forEach((entry) => {
      if (entry.type === 'Addition') additions += entry.value;
      if (entry.type === 'Deletion') deletions += entry.value;
      if (entry.type === 'Tax') taxes += entry.amount;
    });
    // Final Rate Calculation
    finalRate = HARDCODED_RATE + additions - deletions + taxes;
    return { additions, deletions, taxes, finalRate };
  }, [entries]);

  // Keep previous logic and API untouched
  const getSelectedRate = () => {
    if (newMeasurement.selected_rate_id) {
      const selectedRate = itemRates.find(rate => rate.sr_no === newMeasurement.selected_rate_id);
      return selectedRate ? selectedRate.rate : item?.ssr_rate;
    }
    return item?.ssr_rate || 0;
  };

  useEffect(() => {
    if (isOpen && item?.sr_no) {
      fetchData();
    }
  }, [isOpen, item?.sr_no, activeTab]);

  useEffect(() => {
    setCurrentItem(item || {} as SubworkItem);
  }, [item]);

  useEffect(() => {
    calculateRateGroups();
  }, [measurements, itemRates]);

  const calculateQuantity = () => {
    if (newMeasurement.is_manual_quantity && newMeasurement.manual_quantity !== undefined) {
      return newMeasurement.manual_quantity;
    }
    return (newMeasurement.no_of_units || 0) *
      (newMeasurement.length || 0) *
      (newMeasurement.width_breadth || 0) *
      (newMeasurement.height_depth || 0);
  };

  const calculateLineAmount = () => {
    const quantity = calculateQuantity();
    const amount = quantity * getSelectedRate();
    return newMeasurement.is_deduction ? -amount : amount;
  };

  const calculateRateGroups = () => {
    const groups: { [key: string]: { rate: number, quantity: number, description?: string } } = {};
    measurements.forEach(measurement => {
      const rate = getSelectedRateForMeasurement(measurement);
      const rateKey = rate.toString();
      if (!groups[rateKey]) {
        const rateInfo = itemRates.find(r => r.rate === rate);
        groups[rateKey] = {
          rate: rate,
          quantity: 0,
          description: rateInfo?.description
        };
      }
      groups[rateKey].quantity += measurement.calculated_quantity;
    });
    setRateGroups(groups);
  };

  // helper used in calculateRateGroups (kept as-is)
  const getSelectedRateForMeasurement = (measurement: ItemMeasurement) => {
    if (measurement.selected_rate_id) {
      const selected = itemRates.find(r => r.sr_no === measurement.selected_rate_id);
      return selected ? selected.rate : (measurement.rate || item?.ssr_rate || 0);
    }
    return measurement.rate || item?.ssr_rate || 0;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'measurements') {
        const { data, error } = await supabase
          .schema('estimate')
          .from('item_measurements')
          .select('*')
          .eq('subwork_item_id', currentItem.sr_no)
          .order('measurement_sr_no', { ascending: true });
        if (error) throw error;
        setMeasurements(data || []);
      } else if (activeTab === 'leads') {
        const { data, error } = await supabase
          .schema('estimate')
          .from('item_leads')
          .select('*')
          .eq('subwork_item_id', currentItem.sr_no)
          .order('sr_no', { ascending: true });
        if (error) throw error;
        setLeads(data || []);
      } else if (activeTab === 'materials') {
        const { data, error } = await supabase
          .schema('estimate')
          .from('item_materials')
          .select('*')
          .eq('subwork_item_id', currentItem.sr_no)
          .order('material_name', { ascending: true });
        if (error) throw error;
        setMaterials(data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const totalMeasurementQuantity = measurements.reduce((sum, m) => sum + m.calculated_quantity, 0);
  const totalMeasurementAmount = measurements.reduce((sum, m) => sum + m.line_amount, 0);
  const totalLeadCharges = leads.reduce((sum, l) => sum + l.net_lead_charges, 0);
  const totalMaterialCost = materials.reduce((sum, m) => sum + m.total_material_cost, 0);

  if (!isOpen) return null;

  // Add entry handler
  const handleAddEntry = () => {
    if (newTax.label && newTax.type && Number(newTax.value) > 0) {
      const amount = calculateAmount(newTax.type, HARDCODED_RATE, Number(newTax.value));
      setEntries(prev => [...prev, {
        label: newTax.label,
        type: newTax.type,
        value: Number(newTax.value),
        amount,
      }]);
      setNewTax({ label: '', value: '', type: 'Addition' });
      setEditIndex(null);
    }
  };

  // Edit handler
  const handleEdit = (index: number) => {
    const entry = entries[index];
    setNewTax({ label: entry.label, value: entry.value, type: entry.type });
    setEditIndex(index);
  };

  // Update handler
  const handleUpdate = () => {
    if (editIndex !== null && newTax.label && newTax.type && Number(newTax.value) > 0) {
      const amount = calculateAmount(newTax.type, HARDCODED_RATE, Number(newTax.value));
      setEntries(entries.map((ent, idx) =>
        idx === editIndex
          ? { label: newTax.label, type: newTax.type, value: Number(newTax.value), amount }
          : ent
      ));
      setNewTax({ label: '', value: '', type: 'Addition' });
      setEditIndex(null);
    }
  };

  // Delete handler
  const handleDelete = (index: number) => {
    setEntries(prev => prev.filter((_, idx) => idx !== index));
    setEditIndex(null);
    setNewTax({ label: '', value: '', type: 'Addition' });
  };

  // INLINE SAVE FOR NEW ROW (Option A behavior)
  const saveNewRow = (index: number) => {
    const amount = calculateAmount(tempRow.type, HARDCODED_RATE, Number(tempRow.value));
    const newEntry = {
      label: tempRow.label,
      type: tempRow.type,
      value: Number(tempRow.value),
      amount,
    };

    const updated = [...entries];
    updated.splice(index + 1, 0, newEntry);
    setEntries(updated);

    setRowBeingAddedBelow(null);
    setTempRow({ label: '', type: 'Addition', value: 0 });
  };

  // INLINE SAVE FOR EDITED ROW
  const saveEditedRow = (index: number) => {
    const amount = calculateAmount(tempRow.type, HARDCODED_RATE, Number(tempRow.value));

    const updated = entries.map((row, idx) =>
      idx === index ? { label: tempRow.label, type: tempRow.type, value: Number(tempRow.value), amount } : row
    );

    setEntries(updated);
    setRowBeingEdited(null);
    setTempRow({ label: '', type: 'Addition', value: 0 });
  };

  // FINAL RATE TAX HANDLERS
  const openFinalTaxInput = () => {
    setShowFinalTaxInput(true);
    setFinalTaxPercentInput(finalTaxApplied ? finalTaxApplied.percent : 0);
  };

  const saveFinalTax = () => {
    const percent = Number(finalTaxPercentInput) || 0;
    const amount = (summary.finalRate * percent) / 100;
    setFinalTaxApplied({ percent, amount });
    setShowFinalTaxInput(false);
  };

  const cancelFinalTaxInput = () => {
    setShowFinalTaxInput(false);
    setFinalTaxPercentInput(finalTaxApplied ? finalTaxApplied.percent : 0);
  };

  const clearFinalTax = () => {
    setFinalTaxApplied(null);
    setFinalTaxPercentInput(0);
    setShowFinalTaxInput(false);
  };

  const totalRateWithFinalTax = summary.finalRate + (finalTaxApplied ? finalTaxApplied.amount : 0);

  return (
    <div className="fixed inset-0 justify-center bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[60]">
      <div className="relative top-5 mx-auto p-5 border w-11/12 max-w-3xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Item {item?.item_number} - Detailed Analysis
              </h3>
              <p className="text-sm text-gray-500">{item?.description_of_item}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Rate & Form */}
          <div className="mb-4">
            <div className="font-semibold text-base mb-2">Rate: ₹{HARDCODED_RATE}</div>
            <div className="flex flex-row items-end gap-2 w-full mb-2">
              <div className="w-1/4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input
                  type="text"
                  value={newTax.label}
                  onChange={(e) => setNewTax({ ...newTax, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="GST, Labour welfare"
                />
              </div>
              <div className="w-1/4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newTax.type}
                  onChange={(e) => setNewTax({ ...newTax, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Addition">Addition</option>
                  <option value="Deletion">Deletion</option>
                  <option value="Tax">Tax</option>
                </select>
              </div>
              <div className="w-1/4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                <input
                  type="number"
                  value={newTax.value}
                  onChange={(e) => setNewTax({ ...newTax, value: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. 10"
                />
              </div>
              <div className="w-1/4 flex items-center pt-5">
                {editIndex === null ? (
                  <button
                    type="button"
                    onClick={handleAddEntry}
                    className="inline-flex items-center px-2 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleUpdate}
                    className="inline-flex items-center px-2 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Entries Table */}
          {entries.length > 0 && (
            <div className="mb-4">
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 border">Label</th>
                    <th className="px-3 py-2 border">Type</th>
                    <th className="px-3 py-2 border">Value</th>
                    <th className="px-3 py-2 border">Calculated Amount</th>
                    <th className="px-3 py-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => (
                    <React.Fragment key={idx}>
                      <tr>
                        {rowBeingEdited === idx ? (
                          <>
                            <td className="border px-3 py-2">
                              <input
                                className="border p-1 w-full"
                                value={tempRow.label}
                                onChange={(e) => setTempRow({ ...tempRow, label: e.target.value })}
                              />
                            </td>
                            <td className="border px-3 py-2">
                              <select
                                className="border p-1 w-full"
                                value={tempRow.type}
                                onChange={(e) => setTempRow({ ...tempRow, type: e.target.value })}
                              >
                                <option value="Addition">Addition</option>
                                <option value="Deletion">Deletion</option>
                                <option value="Tax">Tax</option>
                              </select>
                            </td>
                            <td className="border px-3 py-2">
                              <input
                                type="number"
                                className="border p-1 w-full"
                                value={tempRow.value}
                                onChange={(e) => setTempRow({ ...tempRow, value: Number(e.target.value) })}
                              />
                            </td>
                            <td className="border px-3 py-2">
                              {formatCurrency(
                                calculateAmount(tempRow.type, HARDCODED_RATE, Number(tempRow.value))
                              )}
                            </td>
                            <td className="border px-3 py-2 flex gap-2">
                              <button onClick={() => saveEditedRow(idx)} className="text-green-600">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => setRowBeingEdited(null)} className="text-gray-600">
                                <CancelIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 border">{entry.label}</td>
                            <td className="px-3 py-2 border">{entry.type}</td>
                            <td className="px-3 py-2 border">{entry.value}</td>
                            <td className="px-3 py-2 border">{formatCurrency(entry.amount)}</td>
                            <td className="px-3 py-2 border flex gap-3">
                              
                              {/* PLUS BUTTON (ADD ROW BELOW) */}
                              <button
                                onClick={() => {
                                  setRowBeingAddedBelow(idx);
                                  setTempRow({ label: '', type: 'Addition', value: 0 });
                                }}
                                className="text-green-600 hover:text-green-800"
                              >
                                <Plus className="w-4 h-4" />
                              </button>

                              {/* EDIT BUTTON */}
                              <button
                                onClick={() => {
                                  setRowBeingEdited(idx);
                                  setTempRow({
                                    label: entry.label,
                                    type: entry.type,
                                    value: entry.value,
                                  });
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* DELETE BUTTON */}
                              <button
                                onClick={() => {
                                  setEntries(entries.filter((_, i) => i !== idx));
                                }}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </>
                        )}
                      </tr>

                      {/* INLINE NEW ROW BELOW */}
                      {rowBeingAddedBelow === idx && (
                        <tr className="bg-gray-50">
                          <td className="border px-3 py-2">
                            <input
                              className="border p-1 w-full"
                              value={tempRow.label}
                              onChange={(e) => setTempRow({ ...tempRow, label: e.target.value })}
                            />
                          </td>
                          <td className="border px-3 py-2">
                            <select
                              className="border p-1 w-full"
                              value={tempRow.type}
                              onChange={(e) => setTempRow({ ...tempRow, type: e.target.value })}
                            >
                              <option value="Addition">Addition</option>
                              <option value="Deletion">Deletion</option>
                              <option value="Tax">Tax</option>
                            </select>
                          </td>
                          <td className="border px-3 py-2">
                            <input
                              type="number"
                              className="border p-1 w-full"
                              value={tempRow.value}
                              onChange={(e) => setTempRow({ ...tempRow, value: Number(e.target.value) })}
                            />
                          </td>
                          <td className="border px-3 py-2">
                            {formatCurrency(
                              calculateAmount(tempRow.type, HARDCODED_RATE, Number(tempRow.value))
                            )}
                          </td>
                          <td className="border px-3 py-2 flex gap-2">
                            <button onClick={() => saveNewRow(idx)} className="text-green-700">
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setRowBeingAddedBelow(null)}
                              className="text-gray-600"
                            >
                              <CancelIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary Section */}
          <div className="bg-gray-50 rounded-md p-4 mt-2 mb-4 flex flex-wrap gap-8">
            <div>
              <div className="font-medium text-gray-700 mb-1">Total Additions</div>
              <div className="font-bold">{formatCurrency(summary.additions)}</div>
            </div>
            <div>
              <div className="font-medium text-gray-700 mb-1">Total Deletions</div>
              <div className="font-bold">{formatCurrency(summary.deletions)}</div>
            </div>
            <div>
              <div className="font-medium text-gray-700 mb-1">Total Taxes</div>
              <div className="font-bold">{formatCurrency(summary.taxes)}</div>
            </div>
            <div>
              <div className="font-medium text-gray-700 mb-1">Final Rate</div>
              <div className="font-bold text-blue-700">{formatCurrency(summary.finalRate)}</div>
            </div>

            {/* New: Add Tax on Final Rate control */}
            <div className="flex items-center gap-3">
              {!finalTaxApplied && !showFinalTaxInput && (
                <button
                  type="button"
                  onClick={openFinalTaxInput}
                  className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                >
                  Add Tax
                </button>
              )}

              {showFinalTaxInput && (
                <div className="flex items-center gap-2 bg-white p-2 rounded border">
                  <label className="text-sm font-medium">Tax %</label>
                  <input
                    type="number"
                    value={finalTaxPercentInput}
                    onChange={(e) => setFinalTaxPercentInput(Number(e.target.value))}
                    className="w-20 px-2 py-1 border rounded"
                  />
                  <button onClick={saveFinalTax} className="text-green-600">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={cancelFinalTaxInput} className="text-gray-600">
                    <CancelIcon className="w-4 h-4" />
                  </button>
                </div>
              )}

              {finalTaxApplied && (
                <div className="text-sm">
                  <div>Tax on Final Rate: {finalTaxApplied.percent}% = {formatCurrency(finalTaxApplied.amount)}</div>
                  <div className="font-semibold">Total Rate: {formatCurrency(totalRateWithFinalTax)}</div>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={openFinalTaxInput}
                      className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                    >
                      Edit Tax
                    </button>
                    <button
                      onClick={clearFinalTax}
                      className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                    >
                      Remove Tax
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
              onClick={onClose}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RateAnalysis;