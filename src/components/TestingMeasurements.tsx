import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { X, Save } from 'lucide-react';

interface TestingMeasurementsProps {
  subworkId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface TestingItem {
  sr_no: number;
  item_number: string;
  description_of_item: string;
  quantity: number;
  description: string;
  required_tests: number;
  total: number;
}

const TestingMeasurements: React.FC<TestingMeasurementsProps> = ({
  subworkId,
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [testingItems, setTestingItems] = useState<TestingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [worksId, setWorksId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetchTestingItems();
    }
  }, [isOpen, subworkId]);

  const fetchTestingItems = async () => {
    try {
      setLoading(true);

      const { data: subworkData } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('works_id, sr_no')
        .eq('subworks_id', subworkId)
        .maybeSingle();

      if (!subworkData) {
        console.error('Subwork not found');
        return;
      }

      setWorksId(subworkData.works_id);

      const { data: items, error: itemsError } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .select('*')
        .eq('subwork_id', subworkId)
        .eq('category', 'testing');

      if (itemsError) {
        console.error('Error fetching items:', itemsError);
        return;
      }

      if (!items || items.length === 0) {
        setTestingItems([]);
        return;
      }

      const itemsWithTestingData = [];

      for (const item of items) {
        const { data: measurements, error: measurementError } = await supabase
          .schema('estimate')
          .from('item_measurements')
          .select('calculated_quantity')
          .eq('subwork_item_id', item.sr_no);

        if (measurementError) {
          console.error('Error fetching measurements for item:', item.sr_no, measurementError);
          continue;
        }

        const totalMeasurement = measurements?.reduce((sum, m) => sum + (m.calculated_quantity || 0), 0) || 0;

        const { data: existingTesting } = await supabase
          .schema('estimate')
          .from('testing_measurements')
          .select('*')
          .eq('subwork_item_id', item.sr_no)
          .maybeSingle();

        itemsWithTestingData.push({
          sr_no: item.sr_no,
          item_number: item.item_number,
          description_of_item: item.description_of_item,
          quantity: existingTesting?.quantity || totalMeasurement,
          description: existingTesting?.description || '',
          required_tests: existingTesting?.required_tests || 0,
          total: existingTesting?.total || 0
        });
      }

      setTestingItems(itemsWithTestingData);
    } catch (error) {
      console.error('Error fetching testing items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (itemSrNo: number, field: string, value: string | number) => {
    setTestingItems(prevItems =>
      prevItems.map(item => {
        if (item.sr_no === itemSrNo) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'required_tests') {
            updatedItem.total = Number(updatedItem.quantity) * Number(updatedItem.required_tests);
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const { data: subworkData } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('sr_no')
        .eq('subworks_id', subworkId)
        .maybeSingle();

      if (!subworkData) {
        alert('Subwork not found');
        return;
      }

      for (const item of testingItems) {
        const { data: existing } = await supabase
          .schema('estimate')
          .from('testing_measurements')
          .select('sr_no')
          .eq('subwork_item_id', item.sr_no)
          .maybeSingle();

        if (existing) {
          await supabase
            .schema('estimate')
            .from('testing_measurements')
            .update({
              quantity: item.quantity,
              description: item.description,
              required_tests: item.required_tests,
              updated_at: new Date().toISOString()
            })
            .eq('sr_no', existing.sr_no);
        } else {
          await supabase
            .schema('estimate')
            .from('testing_measurements')
            .insert({
              works_id: worksId,
              subwork_id: subworkData.sr_no,
              subwork_item_id: item.sr_no,
              quantity: item.quantity,
              description: item.description,
              required_tests: item.required_tests,
              created_by: user?.id
            });
        }
      }

      alert('Testing measurements saved successfully!');
      onClose();
    } catch (error) {
      console.error('Error saving testing measurements:', error);
      alert('Failed to save testing measurements. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-7xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Testing Measurements
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
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : testingItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No testing items found. Add testing items first.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Required Tests
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {testingItems.map((item) => (
                    <tr key={item.sr_no}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {item.item_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="max-w-md">
                          {item.description_of_item}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleInputChange(item.sr_no, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter description"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        <input
                          type="number"
                          step="0.001"
                          value={item.quantity}
                          onChange={(e) => handleInputChange(item.sr_no, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        <input
                          type="number"
                          step="0.001"
                          value={item.required_tests}
                          onChange={(e) => handleInputChange(item.sr_no, 'required_tests', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.total.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Testing Measurements
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TestingMeasurements;
