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
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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
          // First check if this item has rate analysis from lead statement
          const hasLeadEntry = analysis.entries.some((entry: any) => {
            const label = entry.label?.toLowerCase() || '';
            return (
              label.includes('lead') ||
              label.includes('royalty') ||
              label.includes('metal') ||
              label.includes('sand') ||
              label.includes('murum') ||
              label.includes('murrum')
            );
          });

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

            // Extract factors from rate analysis entries based on specific material types
            // Only extract factors for: 80mm metal (HB), Sand, and Murrum
            let metalFactor = 0;
            let murumFactor = 0;
            let sandFactor = 0;

            if (analysis.entries && Array.isArray(analysis.entries)) {
              console.log('Processing rate analysis entries for item:', item.sr_no, analysis.entries);
              analysis.entries.forEach((entry: any) => {
                const label = entry.label?.toLowerCase() || '';
                const factor = entry.factor || 0;

                console.log('Checking entry - label:', entry.label, 'factor:', factor);

                // 1. Check ONLY for "80mm metal (HB)" specifically - search in label field
                if (label.includes('80mm') && label.includes('metal')) {
                  metalFactor = factor;
                  console.log('✓ Found metal factor:', factor, 'for label:', entry.label);
                }

                // 2. Check for Sand - search in label field
                if (label.includes('sand')) {
                  sandFactor = factor;
                  console.log('✓ Found sand factor:', factor, 'for label:', entry.label);
                }

                // 3. Check for Murrum - search in label field
                if (label.includes('murrum') || label.includes('murum')) {
                  murumFactor = factor;
                  console.log('✓ Found murrum factor:', factor, 'for label:', entry.label);
                }
              });

              console.log('Final factors - Metal:', metalFactor, 'Sand:', sandFactor, 'Murrum:', murumFactor);
            }

            // Check if royalty measurement already exists
            const { data: existingRoyalty } = await supabase
              .schema('estimate')
              .from('royalty_measurements')
              .select('*')
              .eq('subwork_item_id', item.sr_no)
              .maybeSingle();

            // Use existing factors if available, otherwise use factors from rate analysis
            const finalMetalFactor = existingRoyalty?.metal_factor !== undefined ? existingRoyalty.metal_factor : metalFactor;
            const finalMurumFactor = existingRoyalty?.murum_factor !== undefined ? existingRoyalty.murum_factor : murumFactor;
            const finalSandFactor = existingRoyalty?.sand_factor !== undefined ? existingRoyalty.sand_factor : sandFactor;

            itemsWithLeadAnalysis.push({
              sr_no: item.sr_no,
              item_number: item.item_number,
              description_of_item: item.description_of_item,
              measurement: existingRoyalty?.measurement || totalMeasurement,
              metal_factor: finalMetalFactor,
              hb_metal: existingRoyalty?.hb_metal || (totalMeasurement * finalMetalFactor),
              murum_factor: finalMurumFactor,
              murum: existingRoyalty?.murum || (totalMeasurement * finalMurumFactor),
              sand_factor: finalSandFactor,
              sand: existingRoyalty?.sand || (totalMeasurement * finalSandFactor)
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

  const handleFactorChange = (itemSrNo: number, field: string, value: number) => {
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

    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Get subwork sr_no
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

      // Save all royalty items
      for (const item of royaltyItems) {
        console.log('Saving royalty item:', item);

        // Check if record exists
        const { data: existing } = await supabase
          .schema('estimate')
          .from('royalty_measurements')
          .select('sr_no')
          .eq('subwork_item_id', item.sr_no)
          .maybeSingle();

        const payload = {
          works_id: worksId,
          subwork_id: subworkData.sr_no,
          subwork_item_id: item.sr_no,
          measurement: item.measurement,
          metal_factor: item.metal_factor,
          hb_metal: item.hb_metal,
          murum_factor: item.murum_factor,
          murum: item.murum,
          sand_factor: item.sand_factor,
          sand: item.sand,
          created_by: user?.id
        };

        console.log('Payload to save:', payload);

        if (existing) {
          // Update
          console.log('Updating existing record:', existing.sr_no);
          const { error: updateError } = await supabase
            .schema('estimate')
            .from('royalty_measurements')
            .update(payload)
            .eq('sr_no', existing.sr_no);

          if (updateError) {
            console.error('Update error:', updateError);
            throw updateError;
          }
        } else {
          // Insert
          console.log('Inserting new record');
          const { error: insertError } = await supabase
            .schema('estimate')
            .from('royalty_measurements')
            .insert(payload);

          if (insertError) {
            console.error('Insert error:', insertError);
            throw insertError;
          }
        }
      }

      setHasChanges(false);
      alert('Royalty measurements saved successfully!');
    } catch (error) {
      console.error('Error saving royalty measurements:', error);
      alert('Error saving royalty measurements. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to close without saving?');
      if (!confirm) return;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-7xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Royalty Measurements
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                hasChanges && !saving
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-sm font-bold text-gray-900 text-right">
                    Total:
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right bg-yellow-50">
                    {royaltyItems.reduce((sum, item) => sum + item.hb_metal, 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-4"></td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right bg-yellow-50">
                    {royaltyItems.reduce((sum, item) => sum + item.murum, 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-4"></td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right bg-yellow-50">
                    {royaltyItems.reduce((sum, item) => sum + item.sand, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
            {royaltyItems.length > 0 && (
              <div className="mt-4 flex justify-end gap-3">
                {hasChanges && (
                  <span className="text-sm text-orange-600 flex items-center gap-1">
                    <span>⚠</span> You have unsaved changes
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className={`px-6 py-2 rounded-md text-sm font-medium ${
                    hasChanges && !saving
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoyaltyMeasurements;
