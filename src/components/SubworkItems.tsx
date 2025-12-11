import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { SubworkItem, ItemMeasurement, ItemRate } from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  Eye,
  Package,
  Calculator,
  X,
  Search,
  CheckCircle
} from 'lucide-react';

interface SubworkItemsProps {
  subworkId: string;
  subworkName: string;
  isOpen: boolean;
  onClose: () => void;
}

const SubworkItems: React.FC<SubworkItemsProps> = ({
  subworkId,
  subworkName,
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [subworkItems, setSubworkItems] = useState<SubworkItem[]>([]);
  const [itemRatesMap, setItemRatesMap] = useState<{ [key: string]: ItemRate[] }>({});
  const [loading, setLoading] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [showMeasurementsModal, setShowMeasurementsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SubworkItem | null>(null);
  const [ssrSuggestions, setSsrSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingSSR, setSearchingSSR] = useState(false);
  const [descriptionQuery, setDescriptionQuery] = useState('');
  // Map the rates for the selected item to only include their descriptions
  const [ratesArray, setRatesArray] = useState<ItemRate[]>([]);
  const [rateDescriptions, setRateDescriptions] = useState<string[]>([]);
  const [selectedSrNo, setSelectedSrNo] = useState();
  const navigate = useNavigate();
  const [showRateAnalysisModal, setShowRateAnalysisModal] = useState(false);
  const [rateAnalysisItem, setRateAnalysisItem] = useState<SubworkItem | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [newItem, setNewItem] = useState<Partial<SubworkItem>>({
    description_of_item: '',
    category: ''
  });
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [itemRates, setItemRates] = useState<Array<{
    description: string;
    rate: number;
    unit: string;
  }>>([{ description: '', rate: 0, unit: '' }]);

  useEffect(() => {
    if (isOpen && subworkId) {
      fetchSubworkItems();
    }
  }, [isOpen, subworkId]);

  const searchSSRItems = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSsrSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setSearchingSSR(true);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ssr-search`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: query.trim() })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // Only show suggestions if we have actual results from the Python file
      if (data.results && data.results.length > 0) {
        setSsrSuggestions(data.results);
        setShowSuggestions(true);
      } else {
        setSsrSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error searching SSR items:', error);
      setSsrSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setSearchingSSR(false);
    }
  };

  const handleDescriptionChange = (value: string) => {
    setDescriptionQuery(value);
    setNewItem({ ...newItem, description_of_item: value });

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If input is empty or too short, clear suggestions
    if (!value || value.trim().length < 2) {
      setSsrSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce search with new timeout
    searchTimeoutRef.current = setTimeout(() => {
      searchSSRItems(value);
    }, 500);
  };

  const selectSSRItem = (item: any) => {
    // Add the SSR item as a new rate entry
    const newRate = {
      description: item.description,
      rate: parseFloat(item.rate_2024_25 || item.rate_2023_24 || '0'),
      unit: item.unit || ''
    };

    setItemRates(prev => {
      const updated = [...prev];
      // Replace the first empty entry or add new one
      const emptyIndex = updated.findIndex(r => !r.description && !r.rate);
      if (emptyIndex >= 0) {
        updated[emptyIndex] = newRate;
      } else {
        updated.push(newRate);
      }
      return updated;
    });

    setDescriptionQuery(item.description);
    setShowSuggestions(false);
    setSsrSuggestions([]);

    // Clear any pending search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };

  const fetchSubworkItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .select('*')
        .eq('subwork_id', subworkId)
        .order('item_number', { ascending: true });

      if (error) throw error;
      setSubworkItems(data || []);

      // Fetch rates for all items
      if (data && data.length > 0) {
        await fetchItemRates(data);
      }
    } catch (error) {
      console.error('Error fetching subwork items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh a specific item's data
  const refreshItemData = async (itemSrNo: number) => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .select('*')
        .eq('sr_no', itemSrNo)
        .single();

      if (error) throw error;

      // Update the item in the local state
      setSubworkItems(prev =>
        prev.map(item =>
          item.sr_no === itemSrNo ? data : item
        )
      );

    } catch (error) {
      console.error('Error refreshing item data:', error);
    }
  };
  const fetchItemRates = async (items: SubworkItem[]) => {
    try {
      const itemSrNos = items.map(item => item.sr_no);

      const { data: rates, error } = await supabase
        .schema('estimate')
        .from('item_rates')
        .select('*')
        .in('subwork_item_sr_no', itemSrNos)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group rates by subwork_item_sr_no
      const ratesMap: { [key: string]: ItemRate[] } = {};
      (rates || []).forEach(rate => {
        const key = rate.subwork_item_sr_no.toString();
        if (!ratesMap[key]) {
          ratesMap[key] = [];
        }
        ratesMap[key].push(rate);
      });

      setItemRatesMap(ratesMap);
    } catch (error) {
      console.error('Error fetching item rates:', error);
    }
  };

  const generateItemNumber = async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .select('item_number')
        .eq('subwork_id', subworkId)
        .order('item_number', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = parseInt(data[0].item_number);
        nextNumber = lastNumber + 1;
      }

      return nextNumber.toString();
    } catch (error) {
      console.error('Error generating item number:', error);
      return '1';
    }
  };

  const handleAddItem = async () => {
    if (!newItem.description_of_item || !user) return;

    // Validate that at least one rate entry is complete
    const validRates = itemRates.filter(rate => rate.description && rate.rate > 0);
    if (validRates.length === 0) {
      alert('Please add at least one valid rate entry with description and rate.');
      return;
    }

    try {
      const itemNumber = await generateItemNumber();

      // Calculate total amount from all rates (for now, just sum all rates)
      const totalAmount = validRates.reduce((sum, rate) => sum + rate.rate, 0);

      // For now, we'll store the first rate's unit as the main unit
      const mainUnit = validRates[0]?.unit || '';

      // Insert the subwork item first
      const { data: insertedItem, error: itemError } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .insert({
          description_of_item: newItem.description_of_item,
          category: newItem.category,
          subwork_id: subworkId,
          item_number: itemNumber,
          // ssr_quantity: newItem.ssr_quantity,
          // rate_total_amount: totalAmount,
          // ssr_unit: mainUnit,
          // total_item_amount: totalAmount,
          created_by: user.id
        })
        .select()
        .single();

      if (itemError) throw itemError;

      // 🔹 Fetch calculated_quantity from item_measurements for this subwork_item
      const { data: measurementData, error: measurementError } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .select('calculated_quantity')
        .eq('subwork_item_id', insertedItem.sr_no)
        .maybeSingle();

      if (measurementError) throw measurementError;

      const ssrQuantity = measurementData?.calculated_quantity || 1;

      // Insert all the rates for this item linked by subwork_item_sr_no
      const ratesToInsert = validRates.map(rate => ({
        subwork_item_sr_no: insertedItem.sr_no,
        description: rate.description,
        rate: rate.rate,
        ssr_unit: rate.unit,
        ssr_quantity: ssrQuantity,
        rate_total_amount: rate.rate * ssrQuantity,
        created_by: user.id
      }));

      const { error: ratesError } = await supabase
        .schema('estimate')
        .from('item_rates')
        .insert(ratesToInsert);

      if (ratesError) throw ratesError;

      setShowAddItemModal(false);
      setNewItem({
        description_of_item: '',
        category: '',
        ssr_quantity: 1
      });
      setItemRates([{ description: '', rate: 0, unit: '' }]);
      setDescriptionQuery('');
      setSsrSuggestions([]);
      setShowSuggestions(false);
      fetchSubworkItems();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleEditItem = (item: SubworkItem) => {
    setSelectedItem(item);
    setDescriptionQuery(item.description_of_item);

    // Load existing rates for this item
    const existingRates = itemRatesMap[item.sr_no.toString()] || [];
    if (existingRates.length > 0) {
      setItemRates(existingRates.map(rate => ({
        description: rate.description,
        rate: rate.rate,
        unit: rate.unit || '',
        ssr_quantity: rate.ssr_quantity || 1
      })));
    } else {
      // Fallback to item's main rate if no separate rates exist
      setItemRates([{
        description: item.description_of_item,
        rate: item.rate_total_amount,
        ssr_unit: item.ssr_unit || '',
        ssr_quantity: 1
      }]);
    }

    setNewItem({
      description_of_item: item.description_of_item,
      category: item.category
    });
    setShowEditItemModal(true);
  };


  const handleUpdateItem = async () => {
    if (!newItem.description_of_item || !selectedItem) return;

    const validRates = itemRates.filter(rate => rate.description && rate.rate > 0);
    if (validRates.length === 0) {
      alert('Please add at least one valid rate entry with description and rate.');
      return;
    }

    try {
      const totalAmount = validRates.reduce((sum, rate) => sum + rate.rate, 0);
      const mainUnit = validRates[0]?.unit || '';

      // Update the subwork item
      const { error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .update({
          description_of_item: newItem.description_of_item,
          category: newItem.category,
          // rate_total_amount: totalAmount,
          ssr_unit: mainUnit,
          total_item_amount: totalAmount
        })
        .eq('sr_no', selectedItem.sr_no);

      if (error) throw error;

      // Delete existing rates for this item
      const { error: deleteError } = await supabase
        .schema('estimate')
        .from('item_rates')
        .delete()
        .eq('subwork_item_sr_no', selectedItem.sr_no);

      if (deleteError) throw deleteError;

      // 🔹 Fetch calculated_quantity from item_measurements for this subwork_item
      const { data: measurementData, error: measurementError } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .select('calculated_quantity')
        .eq('subwork_item_id', selectedItem.sr_no)
        .maybeSingle();

      if (measurementError) throw measurementError;

      const ssrQuantity = measurementData?.calculated_quantity || 1;

      // Insert updated rates
      const ratesToInsert = validRates.map(rate => ({
        subwork_item_sr_no: selectedItem.sr_no,
        description: rate.description,
        rate: rate.rate,
        ssr_unit: rate.unit,
        ssr_quantity: ssrQuantity,
        rate_total_amount: rate.rate * ssrQuantity,
        created_by: user.id
      }));

      const { error: ratesError } = await supabase
        .schema('estimate')
        .from('item_rates')
        .insert(ratesToInsert);

      if (ratesError) throw ratesError;

      setShowEditItemModal(false);
      setSelectedItem(null);
      setNewItem({
        description_of_item: '',
        category: ''
      });
      setItemRates([{ description: '', rate: 0, unit: '' }]);
      fetchSubworkItems();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleDeleteItem = async (item: SubworkItem) => {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete rates first (should cascade automatically, but being explicit)
      await supabase
        .schema('estimate')
        .from('item_rates')
        .delete()
        .eq('subwork_item_sr_no', item.sr_no);

      // Delete the item
      const { error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .delete()
        .eq('sr_no', item.sr_no);

      if (error) throw error;
      fetchSubworkItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleViewMeasurements = (item: SubworkItem) => {
    setSelectedItem(item);
    const selectedItemSrno = item?.sr_no?.toString();
    const newRatesArray = selectedItemSrno ? itemRatesMap[selectedItemSrno] || [] : [];
    const newRateDescriptions = newRatesArray.map(rate => rate.description);
    const rateSrNo = newRatesArray.map(rate => rate.sr_no);
    setRatesArray(newRatesArray);
    setSelectedSrNo(rateSrNo);
    setRateDescriptions(newRateDescriptions);
    setShowMeasurementsModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getItemTotalFromRates = (itemSrNo: number): number => {
    const rates = itemRatesMap[itemSrNo.toString()] || [];
    return rates.reduce((sum, rate) => sum + rate.rate, 0);
  };

  const getItemRatesDisplay = (itemSrNo: number): string => {
    const rates = itemRatesMap[itemSrNo.toString()] || [];
    if (rates.length === 0) return 'No rates';
    if (rates.length === 1) return `₹${rates[0].rate.toFixed(2)}`;
    return `${rates.length} rates (₹${rates.reduce((sum, rate) => sum + rate.rate, 0).toFixed(2)})`;
  };

  const totalItemsAmount = Object.values(itemRatesMap).flat().reduce((sum, rate) => sum + rate.rate_total_amount, 0);

  const addRateEntry = () => {
    setItemRates(prev => [...prev, { description: '', rate: 0, unit: '' }]);
  };

  const removeRateEntry = (index: number) => {
    if (itemRates.length > 1) {
      setItemRates(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateRateEntry = (index: number, field: string, value: any) => {
    setItemRates(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Items - {subworkId}
              </h3>
              <p className="text-sm text-gray-500">{subworkName}</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-sm text-gray-600">
                Total: {formatCurrency(totalItemsAmount)}
              </div>
              <button
                onClick={() => setShowAddItemModal(true)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
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
                <p className="mt-2 text-sm text-gray-500">Loading items...</p>
              </div>
            ) : subworkItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item No
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rate
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {subworkItems.map((item) => (
                      <tr key={`${item.subwork_id}-${item.item_number}`} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {item.item_number}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-sm font-medium text-gray-900">
                            {item.description_of_item}
                          </div>
                          {/* Show individual rates if multiple rates exist */}
                          {itemRatesMap[item.sr_no.toString()] && itemRatesMap[item.sr_no.toString()].length > 1 && (
                            <div className="mt-2 space-y-1">
                              {itemRatesMap[item.sr_no.toString()].map((rate, index) => (
                                <div key={index} className="text-xs bg-gray-50 p-2 rounded border-l-2 border-blue-200">
                                  <div className="font-medium text-gray-700">{rate.description}</div>
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-gray-600">₹{rate.rate.toFixed(2)}</span>
                                    {rate.unit && <span className="text-gray-500">per {rate.unit}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                          {item.category || '-'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          {itemRatesMap[item.sr_no.toString()] && itemRatesMap[item.sr_no.toString()].length > 0 ? (
                            <div className="space-y-1">
                              {itemRatesMap[item.sr_no.toString()].map((rate, index) => {
                                // Use ssr_quantity from the rate fetched from database
                                const rateQuantity = rate.ssr_quantity;
                                return (
                                  <div key={index} className="bg-gray-50 px-2 py-1 rounded text-xs">
                                    <div className="text-gray-900 font-medium">{rateQuantity.toFixed(0)} {rate.ssr_unit || item.ssr_unit}</div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div>
                              {/* Fallback, if no rates found, show quantity from item */}
                              <div className="font-medium">{item.ssr_quantity} {item.ssr_unit}</div>
                              <div className="text-xs text-gray-500">(Auto-calculated)</div>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {itemRatesMap[item.sr_no.toString()] && itemRatesMap[item.sr_no.toString()].length > 0 ? (
                              <div className="space-y-1">
                                {itemRatesMap[item.sr_no.toString()].map((rate, index) => (
                                  <div key={index} className="text-xs">
                                    <div className="bg-gray-50 p-2 rounded border-l-2 border-blue-200">
                                      <div className="text-gray-900 font-medium">₹{rate.rate}</div>
                                    </div>
                                    {rate.unit && <span className="text-gray-500 ml-1">/{rate.unit}</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">No rates available</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="space-y-1">
                            {itemRatesMap[item.sr_no.toString()] && itemRatesMap[item.sr_no.toString()].length > 0 ? (
                              itemRatesMap[item.sr_no.toString()].map((rate, index) => {
                                const rateQuantity = rate.ssr_quantity ?? 0;
                                const rateAmount = (rateQuantity * rate.rate).toFixed(2);
                                return (
                                  <div key={index} className="text-xs bg-gray-50 p-1 rounded">
                                    <span className="font-medium text-green-600">
                                      ₹{rateAmount}
                                    </span>
                                    <div className="text-gray-500 text-xs">
                                      {rateQuantity.toFixed(3)} × ₹{rate.rate}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <span className="text-gray-500">₹0.00</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewMeasurements(item)}
                              className="text-purple-600 hover:text-purple-900 p-1 rounded"
                              title="View Measurements"
                            >
                              <Calculator className="w-4 h-4" />
                            </button>
                            {/* <button
                              onClick={() => handleEditItem(item)}
                              className="text-green-600 hover:text-green-900 p-1 rounded"
                              title="Edit Item"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button> */}
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="text-red-600 hover:text-red-900 p-1 rounded"
                              title="Delete Item"
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
                <Package className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add items to this sub work for detailed estimation.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowAddItemModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
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

      {showRateAnalysisModal && rateAnalysisItem && (
        <RateAnalysis
          isOpen={showRateAnalysisModal}
          onClose={() => {
            setShowRateAnalysisModal(false);
            setRateAnalysisItem(null);
          }}
          item={rateAnalysisItem}
        />
      )}

      {/* Add Item Modal */}
      
      {showAddItemModal && (
        <div
          className={`fixed inset-0 overflow-y-auto h-full w-full ${showRateAnalysisModal ? 'bg-gray-600 bg-opacity-50 blur-sm' : 'bg-gray-600 bg-opacity-50'
            } z-40`}
        >
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add New Item</h3>
                <button
                  onClick={() => {
                    setShowAddItemModal(false);
                    setDescriptionQuery('');
                    setSsrSuggestions([]);
                    setShowSuggestions(false);
                    if (searchTimeoutRef.current) {
                      clearTimeout(searchTimeoutRef.current);
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sub Work
                  </label>
                  <input
                    type="text"
                    value={`${subworkId} - ${subworkName}`}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newItem.category || ''}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select category (optional)</option>
                    <option value="With GST">With GST</option>
                    <option value="Without GST">Without GST</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description of Item *
                  </label>
                  <div className="flex items-center mb-2">
                    <button
                      type="button"
                      onClick={() => setIsManualEntry(!isManualEntry)}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      {isManualEntry ? 'Switch to SSR Search' : 'Switch to Manual Entry'}
                    </button>
                  </div>

                  {isManualEntry ? (
                    <textarea
                      value={newItem.description_of_item || ''}
                      onChange={(e) => setNewItem({ ...newItem, description_of_item: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter item description manually..."
                      rows={3}
                      required
                    />
                  ) : (
                    <div className="relative">
                      <textarea
                        value={descriptionQuery}
                        onChange={(e) => handleDescriptionChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter item description manually or search SSR items..."
                        rows={3}
                      />
                      {searchingSSR && (
                        <div className="absolute right-3 top-3">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        </div>
                      )}

                      {/* SSR Suggestions Dropdown */}
                      {showSuggestions && ssrSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          <div className="p-2 text-xs text-gray-500 border-b">
                            <Search className="w-3 h-3 inline mr-1" />
                            SSR Rate Suggestions from Database
                          </div>
                          {ssrSuggestions.map((item, index) => (
                            <div
                              key={index}
                              onClick={() => selectSSRItem(item)}
                              className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {item.sr_no && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                                        Item {item.sr_no}
                                      </span>
                                    )}
                                    {item.description}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Section: {item.section} | Page: {item.page_number}
                                  </div>
                                  <div className="flex items-center mt-1 space-x-4">
                                    {item.unit && (
                                      <span className="text-xs text-gray-600">
                                        Unit: <span className="font-medium">{item.unit}</span>
                                      </span>
                                    )}
                                    {item.rate_2024_25 && (
                                      <span className="text-xs text-green-600">
                                        Rate 2024-25: <span className="font-medium">₹{item.rate_2024_25}</span>
                                      </span>
                                    )}
                                    {item.rate_2023_24 && (
                                      <span className="text-xs text-blue-600">
                                        Rate 2023-24: <span className="font-medium">₹{item.rate_2023_24}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="ml-2">
                                  <div className="text-xs text-gray-500">
                                    {Math.round(item.confidence * 100)}% match
                                  </div>
                                  <CheckCircle className="w-4 h-4 text-green-500 mt-1" />
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="p-2 text-xs text-gray-400 text-center border-t">
                            Click on an item to auto-fill rate and unit from SSR database
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Multiple Rates Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Rates *
                    </label>
                    <button
                      type="button"
                      onClick={addRateEntry}
                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-600 bg-blue-100 hover:bg-blue-200"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Rate
                    </button>
                  </div>

                  <div className="border border-gray-300 rounded-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate (₹)</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {itemRates.map((rate, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={rate.description}
                                onChange={(e) => updateRateEntry(index, 'description', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Material/work description"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={rate.rate || ''}
                                onChange={(e) => updateRateEntry(index, 'rate', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={rate.unit}
                                onChange={(e) => updateRateEntry(index, 'unit', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="sqm, cum, nos"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  // Use the selectedItem when editing, otherwise use the newItem (cast to SubworkItem)
                                  setRateAnalysisItem(selectedItem ?? (newItem as SubworkItem));
                                  setShowRateAnalysisModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 p-1 mr-2"
                              >
                                Rate Analysis
                              </button>
                              {itemRates.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeRateEntry(index)}
                                  className="text-red-600 hover:text-red-800 p-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium text-gray-900">
                      ₹{itemRates.reduce((sum, rate) => sum + (rate.rate || 0), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={!newItem.description_of_item || itemRates.every(rate => !rate.description || !rate.rate)}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditItemModal && selectedItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-40">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Item</h3>
                <button
                  onClick={() => setShowEditItemModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Number
                  </label>
                  <input
                    type="text"
                    value={selectedItem.item_number}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newItem.category || ''}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter category (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description of Item *
                  </label>
                  <div className="relative">
                    <textarea
                      value={descriptionQuery}
                      onChange={(e) => handleDescriptionChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter item description manually or search SSR items..."
                      rows={3}
                    />
                    {searchingSSR && (
                      <div className="absolute right-3 top-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      </div>
                    )}

                    {/* SSR Suggestions Dropdown */}
                    {showSuggestions && ssrSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2 text-xs text-gray-500 border-b">
                          <Search className="w-3 h-3 inline mr-1" />
                          SSR Rate Suggestions from Database
                        </div>
                        {ssrSuggestions.map((item, index) => (
                          <div
                            key={index}
                            onClick={() => selectSSRItem(item)}
                            className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {item.sr_no && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                                      Item {item.sr_no}
                                    </span>
                                  )}
                                  {item.description}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Section: {item.section} | Page: {item.page_number}
                                </div>
                                <div className="flex items-center mt-1 space-x-4">
                                  {item.unit && (
                                    <span className="text-xs text-gray-600">
                                      Unit: <span className="font-medium">{item.unit}</span>
                                    </span>
                                  )}
                                  {item.rate_2024_25 && (
                                    <span className="text-xs text-green-600">
                                      Rate 2024-25: <span className="font-medium">₹{item.rate_2024_25}</span>
                                    </span>
                                  )}
                                  {item.rate_2023_24 && (
                                    <span className="text-xs text-blue-600">
                                      Rate 2023-24: <span className="font-medium">₹{item.rate_2023_24}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="ml-2">
                                <div className="text-xs text-gray-500">
                                  {Math.round(item.confidence * 100)}% match
                                </div>
                                <CheckCircle className="w-4 h-4 text-green-500 mt-1" />
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="p-2 text-xs text-gray-400 text-center border-t">
                          Click on an item to auto-fill rate and unit from SSR database
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Multiple Rates Table for Edit */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Rates *
                    </label>
                    <button
                      type="button"
                      onClick={addRateEntry}
                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-600 bg-blue-100 hover:bg-blue-200"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Rate
                    </button>
                  </div>

                  <div className="border border-gray-300 rounded-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate (₹)</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {itemRates.map((rate, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={rate.description}
                                onChange={(e) => updateRateEntry(index, 'description', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Material/work description"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={rate.rate || ''}
                                onChange={(e) => updateRateEntry(index, 'rate', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={rate.unit}
                                onChange={(e) => updateRateEntry(index, 'unit', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="sqm, cum, nos"
                              />
                            </td>
                            <td className="px-3 py-2">
                              {itemRates.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeRateEntry(index)}
                                  className="text-red-600 hover:text-red-800 p-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium text-gray-900">
                      ₹{itemRates.reduce((sum, rate) => sum + (rate.rate || 0), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditItemModal(false);
                    setDescriptionQuery('');
                    setSsrSuggestions([]);
                    setShowSuggestions(false);
                    if (searchTimeoutRef.current) {
                      clearTimeout(searchTimeoutRef.current);
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateItem}
                  disabled={!newItem.description_of_item || itemRates.every(rate => !rate.description || !rate.rate)}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Measurements Modal */}
      Then your JSX stays the same:

      {showMeasurementsModal && selectedItem && (
        <ItemMeasurements
          item={selectedItem}
          isOpen={showMeasurementsModal}
          onClose={() => setShowMeasurementsModal(false)}
          onItemUpdated={refreshItemData}
          availableRates={ratesArray}
          rateDescriptions={rateDescriptions}
          selectedSrNo={selectedSrNo}
        />
      )}
    </div>
  );
};

// Import the ItemMeasurements component
import ItemMeasurements from './ItemMeasurements';
import { useNavigate } from 'react-router-dom';
import RateAnalysis from './RateAnalysis';

export default SubworkItems;