import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

interface RoyaltyMeasurementsProps {
  subworkId: string;
  worksId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface RoyaltyItem {
  sr_no: number;
  item_number: string;
  description_of_item: string;
  measurement: number;
  metal_factor: number;
  hb_metal: number;
  murum_factor: number;
  murum: number;
  sand_factor: number;
  sand: number;
}

const RoyaltyMeasurements: React.FC<RoyaltyMeasurementsProps> = ({
  subworkId,
  worksId,
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [royaltyItems, setRoyaltyItems] = useState<RoyaltyItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && subworkId && worksId) {
      fetchRoyaltyItems();
    }
  }, [isOpen, subworkId, worksId]);

  const fetchRoyaltyItems = async () => {
    try {
      setLoading(true);

      // Get subwork sr_no from subwork_id
      const { data: subworkData, error: subworkError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('sr_no')
        .eq('subworks_id', subworkId)
        .maybeSingle();

      if (subworkError) throw subworkError;
      if (!subworkData) {
        console.error('Subwork not found');
        return;
      }

      const subworkSrNo = subworkData.sr_no;

      // Fetch all items from this subwork
      const { data: items, error: itemsError } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .select('sr_no, item_number, description_of_item')
        .eq('subwork_id', subworkId);

      if (itemsError) throw itemsError;
      if (!items || items.length === 0) {
        setRoyaltyItems([]);
        return;
      }

      // Filter items that have rate analysis with lead statement entries
      const itemsWithLeadAnalysis = [];

      for (const item of items) {
        // Check if item has rate analysis
        const { data: analysis, error: analysisError } = await supabase
          .schema('estimate')
          .from('item_rate_analysis')
          .select('entries')
          .eq('subwork_item_id', item.sr_no)
          .maybeSingle();

        if (analysisError) {
          console.error('Error fetching analysis for item:', item.sr_no, analysisError);
          continue;
        }

        // Check if entries contain lead statement data
        if (analysis && analysis.entries && Array.isArray(analysis.entries)) {
          const hasLeadEntry = analysis.entries.some((entry: any) =>
            entry.label && (
              entry.label.toLowerCase().includes('lead') ||
              entry.label.toLowerCase().includes('royalty') ||
              entry.label.toLowerCase().includes('metal') ||
              entry.label.toLowerCase().includes('sand') ||
              entry.label.toLowerCase().includes('murum')
            )
          );

          if (hasLeadEntry) {
            // Get measurement from item_measurements
            const { data: measurements, error: measurementError } = await supabase
              .schema('estimate')
              .from('item_measurements')
              .select('calculated_quantity')
              .eq('subwork_item_id', item.sr_no);

            if (measurementError) {
              console.error('Error fetching measurements for item:', item.sr_no, measurementError);
              continue;
            }

            // Calculate total measurement
            const totalMeasurement = measurements?.reduce((sum, m) => sum + (m.calculated_quantity || 0), 0) || 0;

            // Check if royalty measurement already exists
            const { data: existingRoyalty } = await supabase
              .schema('estimate')
              .from('royalty_measurements')
              .select('*')
              .eq('subwork_item_id', item.sr_no)
              .maybeSingle();

            itemsWithLeadAnalysis.push({
              sr_no: item.sr_no,
              item_number: item.item_number,
              description_of_item: item.description_of_item,
              measurement: existingRoyalty?.measurement || totalMeasurement,
              metal_factor: existingRoyalty?.metal_factor || 0,
              hb_metal: existingRoyalty?.hb_metal || 0,
              murum_factor: existingRoyalty?.murum_factor || 0,
              murum: existingRoyalty?.murum || 0,
              sand_factor: existingRoyalty?.sand_factor || 0,
              sand: existingRoyalty?.sand || 0
            });
          }
        }
      }

      setRoyaltyItems(itemsWithLeadAnalysis);
    } catch (error) {
      console.error('Error fetching royalty items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFactorChange = async (itemSrNo: number, field: string, value: number) => {
    // Update local state
    setRoyaltyItems(prev => prev.map(item => {
      if (item.sr_no === itemSrNo) {
        const updated = { ...item, [field]: value };

        // Recalculate computed fields
        if (field === 'metal_factor' || field === 'measurement') {
          updated.hb_metal = updated.measurement * updated.metal_factor;
        }
        if (field === 'murum_factor' || field === 'measurement') {
          updated.murum = updated.measurement * updated.murum_factor;
        }
        if (field === 'sand_factor' || field === 'measurement') {
          updated.sand = updated.measurement * updated.sand_factor;
        }

        return updated;
      }
      return item;
    }));

    // Get subwork sr_no
    const { data: subworkData } = await supabase
      .schema('estimate')
      .from('subworks')
      .select('sr_no')
      .eq('subworks_id', subworkId)
      .maybeSingle();

    if (!subworkData) return;

    // Find the item
    const item = royaltyItems.find(i => i.sr_no === itemSrNo);
    if (!item) return;

    // Update with new value
    const updatedItem = { ...item, [field]: value };

    // Recalculate computed fields
    const measurement = field === 'measurement' ? value : updatedItem.measurement;
    const metal_factor = field === 'metal_factor' ? value : updatedItem.metal_factor;
    const murum_factor = field === 'murum_factor' ? value : updatedItem.murum_factor;
    const sand_factor = field === 'sand_factor' ? value : updatedItem.sand_factor;

    // Check if record exists
    const { data: existing } = await supabase
      .schema('estimate')
      .from('royalty_measurements')
      .select('sr_no')
      .eq('subwork_item_id', itemSrNo)
      .maybeSingle();

    const payload = {
      works_id: worksId,
      subwork_id: subworkData.sr_no,
      subwork_item_id: itemSrNo,
      measurement: measurement,
      metal_factor: metal_factor,
      murum_factor: murum_factor,
      sand_factor: sand_factor,
      created_by: user?.id
    };

    if (existing) {
      // Update
      await supabase
        .schema('estimate')
        .from('royalty_measurements')
        .update(payload)
        .eq('sr_no', existing.sr_no);
    } else {
      // Insert
      await supabase
        .schema('estimate')
        .from('royalty_measurements')
        .insert(payload);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-7xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Royalty Measurements
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading royalty items...</p>
          </div>
        ) : royaltyItems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No items with lead analysis found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item No
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Measurement
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Metal Factor
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    H.B. Metal
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Murum Factor
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Murum
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sand Factor
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sand
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {royaltyItems.map((item) => (
                  <tr key={item.sr_no} className="hover:bg-gray-50">
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.item_number}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-900">
                      {item.description_of_item}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                      <input
                        type="number"
                        value={item.measurement || ''}
                        onChange={(e) => handleFactorChange(item.sr_no, 'measurement', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="0.01"
                      />
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                      <input
                        type="number"
                        value={item.metal_factor || ''}
                        onChange={(e) => handleFactorChange(item.sr_no, 'metal_factor', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="0.01"
                      />
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-gray-900 bg-gray-50">
                      {item.hb_metal.toFixed(2)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                      <input
                        type="number"
                        value={item.murum_factor || ''}
                        onChange={(e) => handleFactorChange(item.sr_no, 'murum_factor', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="0.01"
                      />
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-gray-900 bg-gray-50">
                      {item.murum.toFixed(2)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                      <input
                        type="number"
                        value={item.sand_factor || ''}
                        onChange={(e) => handleFactorChange(item.sr_no, 'sand_factor', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="0.01"
                      />
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-gray-900 bg-gray-50">
                      {item.sand.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoyaltyMeasurements;
