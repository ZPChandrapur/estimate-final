import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { X, Plus, Trash2 } from 'lucide-react';

interface RoyaltyTestingItemsProps {
  subworkId: string;
  category: 'royalty' | 'testing';
  isOpen: boolean;
  onClose: () => void;
  onItemAdded?: () => void;
}

const RoyaltyTestingItems: React.FC<RoyaltyTestingItemsProps> = ({
  subworkId,
  category,
  isOpen,
  onClose,
  onItemAdded
}) => {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [rates, setRates] = useState<Array<{
    description: string;
    rate: number;
    unit: string;
  }>>([{ description: '', rate: 0, unit: '' }]);

  const generateItemNumber = async (): Promise<string> => {
    const { data, error } = await supabase
      .schema('estimate')
      .from('subwork_items')
      .select('item_number')
      .eq('subwork_id', subworkId)
      .order('item_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching last item number:', error);
      return '1';
    }

    if (!data) return '1';

    const lastNumber = parseInt(data.item_number);
    return (lastNumber + 1).toString();
  };

  const handleAddRate = () => {
    setRates([...rates, { description: '', rate: 0, unit: '' }]);
  };

  const handleRemoveRate = (index: number) => {
    if (rates.length > 1) {
      setRates(rates.filter((_, i) => i !== index));
    }
  };

  const handleRateChange = (index: number, field: string, value: string | number) => {
    const updatedRates = [...rates];
    updatedRates[index] = { ...updatedRates[index], [field]: value };
    setRates(updatedRates);
  };

  const handleSubmit = async () => {
    if (!description || !user) return;

    const validRates = rates.filter(rate => rate.description && rate.rate > 0 && rate.unit);
    if (validRates.length === 0) {
      alert('Please add at least one valid rate entry with description, rate, and unit.');
      return;
    }

    try {
      const itemNumber = await generateItemNumber();

      const { data: insertedItem, error: itemError } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .insert({
          description_of_item: description,
          category: category,
          subwork_id: subworkId,
          item_number: itemNumber,
          ssr_rate: validRates[0]?.rate || 0,
          ssr_unit: validRates[0]?.unit || '',
          created_by: user.id
        })
        .select()
        .single();

      if (itemError) throw itemError;

      const { data: measurementData } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .select('calculated_quantity')
        .eq('subwork_item_id', insertedItem.sr_no)
        .maybeSingle();

      const ssrQuantity = measurementData?.calculated_quantity || 1;

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

      setDescription('');
      setRates([{ description: '', rate: 0, unit: '' }]);

      if (onItemAdded) {
        onItemAdded();
      }

      onClose();
    } catch (error) {
      console.error(`Error adding ${category} item:`, error);
      alert(`Failed to add ${category} item. Please try again.`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Add {category === 'royalty' ? 'Royalty' : 'Testing'} Charges
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Enter ${category} charges description`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Rate Details
              </label>
              <button
                onClick={handleAddRate}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Rate
              </button>
            </div>

            <div className="space-y-3">
              {rates.map((rate, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={rate.description}
                      onChange={(e) => handleRateChange(index, 'description', e.target.value)}
                      placeholder="Material/Item name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      value={rate.rate || ''}
                      onChange={(e) => handleRateChange(index, 'rate', parseFloat(e.target.value) || 0)}
                      placeholder="Rate"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="text"
                      value={rate.unit}
                      onChange={(e) => handleRateChange(index, 'unit', e.target.value)}
                      placeholder="Unit"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {rates.length > 1 && (
                    <button
                      onClick={() => handleRemoveRate(index)}
                      className="p-2 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!description || rates.every(r => !r.description || !r.rate || !r.unit)}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add {category === 'royalty' ? 'Royalty' : 'Testing'} Item
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoyaltyTestingItems;
