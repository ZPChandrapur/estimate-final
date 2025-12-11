import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem, ItemMeasurement } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { 
  BarChart3, 
  FileText,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Check,
  X,
  Calculator,
  BookOpen
} from 'lucide-react';

interface EstimateData {
  work: Work;
  subworks: SubWork[];
  subworkItems: { [subworkId: string]: SubworkItem[] };
  totalEstimateAmount: number;
}

interface MeasurementData {
  measurements: ItemMeasurement[];
  totalMeasurementAmount: number;
}

interface ComparisonResult {
  worksId: string;
  workName: string;
  estimateAmount: number;
  measurementAmount: number;
  difference: number;
  percentageVariance: number;
  status: 'over' | 'under' | 'equal';
  subworkDetails: SubworkComparison[];
}

interface SubworkComparison {
  subworkId: string;
  subworkName: string;
  estimateAmount: number;
  measurementAmount: number;
  difference: number;
  percentageVariance: number;
  status: 'over' | 'under' | 'equal';
  measurementDetails?: MeasurementDetail[];
  changedItems?: ChangedItemDetail[];
}

interface ChangedItemDetail {
  itemId: number;
  description: string;
  originalEstimate: number;
  revisedAmount: number;
  change: number;
  percentageChange: number;
}

interface MeasurementDetail {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  itemDescription: string;
}

const Compare: React.FC = () => {
  const { t } = useLanguage();
  const [works, setWorks] = useState<Work[]>([]);
  const [selectedWorksIds, setSelectedWorksIds] = useState<string[]>([]);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [expandedWork, setExpandedWork] = useState<string | null>(null);
  const [expandedSubwork, setExpandedSubwork] = useState<string | null>(null);

  useEffect(() => {
    fetchWorks();
  }, []);

  const fetchWorks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .order('sr_no', { ascending: false });

      if (error) throw error;
      setWorks(data || []);
    } catch (error) {
      console.error('Error fetching works:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEstimateData = async (worksId: string): Promise<EstimateData | null> => {
    try {
      // Fetch work details
      const { data: work, error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .eq('works_id', worksId)
        .single();

      if (workError || !work) return null;

      // Fetch subworks
      const { data: subworks, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', worksId);

      if (subworksError) return null;

      // Fetch subwork items for all subworks
      const subworkItems: { [subworkId: string]: SubworkItem[] } = {};
      let totalEstimateAmount = 0;

      for (const subwork of subworks || []) {
        const { data: items } = await supabase
          .schema('estimate')
          .from('subwork_items')
          .select('*')
          .eq('subwork_id', subwork.subworks_id);

        subworkItems[subwork.subworks_id] = items || [];
        
        // Calculate total from subwork items
        const subworkTotal = (items || []).reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
        totalEstimateAmount += subworkTotal;
      }

      return {
        work,
        subworks: subworks || [],
        subworkItems,
        totalEstimateAmount
      };
    } catch (error) {
      console.error('Error fetching estimate data:', error);
      return null;
    }
  };

  const fetchMeasurementData = async (worksId: string): Promise<{
    totalAmount: number;
    subworkAmounts: { [subworkId: string]: number };
    changedItemsBySubwork: { [subworkId: string]: ChangedItemDetail[] };
  } | null> => {
    try {
      // Fetch all subworks for this work
      const { data: subworks, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('subworks_id')
        .eq('works_id', worksId);

      if (subworksError) {
        console.error('Error fetching subworks:', subworksError);
        return null;
      }

      const subworkIds = (subworks || []).map(s => s.subworks_id);

      if (subworkIds.length === 0) {
        return { totalAmount: 0, subworkAmounts: {}, changedItemsBySubwork: {} };
      }

      // Fetch all subwork items with their estimated amounts
      const { data: allItems, error: itemsError } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .select('sr_no, subwork_id, description_of_item, total_item_amount')
        .in('subwork_id', subworkIds);

      if (itemsError) {
        console.error('Error fetching subwork items:', itemsError);
        return null;
      }

      // Fetch all measurements for these subwork items
      const itemIds = (allItems || []).map(item => item.sr_no);

      const { data: measurements, error: measurementsError } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .select('subwork_item_id, line_amount')
        .in('subwork_item_id', itemIds);

      if (measurementsError) {
        console.error('Error fetching measurements:', measurementsError);
        return null;
      }

      // Create a map of measured amounts by item
      const measuredAmountsByItem = new Map<number, number>();
      (measurements || []).forEach((m: any) => {
        const itemId = m.subwork_item_id;
        const currentAmount = measuredAmountsByItem.get(itemId) || 0;
        measuredAmountsByItem.set(itemId, currentAmount + (Number(m.line_amount) || 0));
      });

      // Calculate revised amounts and track changes
      const subworkAmounts: { [subworkId: string]: number } = {};
      const changedItemsBySubwork: { [subworkId: string]: ChangedItemDetail[] } = {};
      let totalAmount = 0;

      (allItems || []).forEach(item => {
        const subworkId = item.subwork_id;
        const originalEstimate = Number(item.total_item_amount) || 0;

        // Check if this item has measurements
        const hasMeasurements = measuredAmountsByItem.has(item.sr_no);
        const revisedAmount = hasMeasurements
          ? measuredAmountsByItem.get(item.sr_no)!
          : originalEstimate;

        // Track changed items
        if (hasMeasurements && Math.abs(revisedAmount - originalEstimate) > 0.01) {
          if (!changedItemsBySubwork[subworkId]) {
            changedItemsBySubwork[subworkId] = [];
          }

          const change = revisedAmount - originalEstimate;
          const percentageChange = originalEstimate > 0
            ? (change / originalEstimate) * 100
            : 0;

          changedItemsBySubwork[subworkId].push({
            itemId: item.sr_no,
            description: item.description_of_item,
            originalEstimate,
            revisedAmount,
            change,
            percentageChange
          });
        }

        // Calculate totals
        if (!subworkAmounts[subworkId]) {
          subworkAmounts[subworkId] = 0;
        }
        subworkAmounts[subworkId] += revisedAmount;
        totalAmount += revisedAmount;
      });

      return {
        totalAmount,
        subworkAmounts,
        changedItemsBySubwork
      };
    } catch (error) {
      console.error('Error fetching measurement data:', error);
      return null;
    }
  };

  const fetchDetailedMeasurementData = async (subworkId: string): Promise<MeasurementDetail[]> => {
    try {
      // Get subwork items for this subwork
      const { data: subworkItems, error: itemsError } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .select('sr_no, description_of_item')
        .eq('subwork_id', subworkId);

      if (itemsError) {
        console.error('Error fetching subwork items:', itemsError);
        return [];
      }

      const itemIds = (subworkItems || []).map(item => item.sr_no);

      if (itemIds.length === 0) {
        return [];
      }

      // Fetch measurements for these items
      const { data: measurements, error } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .select('*')
        .in('subwork_item_id', itemIds);

      if (error) {
        console.error('Error fetching detailed measurement data:', error);
        return [];
      }

      // Create a map of item descriptions
      const itemDescMap = new Map(
        (subworkItems || []).map(item => [item.sr_no, item.description_of_item])
      );

      return (measurements || []).map((measurement: any) => ({
        id: measurement.sr_no.toString(),
        description: measurement.description_of_items || '',
        quantity: Number(measurement.calculated_quantity) || 0,
        unit: measurement.unit || '',
        rate: Number(measurement.line_amount) / (Number(measurement.calculated_quantity) || 1),
        amount: Number(measurement.line_amount) || 0,
        itemDescription: itemDescMap.get(measurement.subwork_item_id) || ''
      }));
    } catch (error) {
      console.error('Error fetching detailed measurement data:', error);
      return [];
    }
  };

  const performComparison = async () => {
    if (selectedWorksIds.length === 0) {
      alert('Please select at least one work to compare');
      return;
    }

    try {
      setComparing(true);
      const results: ComparisonResult[] = [];

      for (const worksId of selectedWorksIds) {
        const work = works.find(w => w.works_id === worksId);
        if (!work) continue;

        const [estimateData, measurementData] = await Promise.all([
          fetchEstimateData(worksId),
          fetchMeasurementData(worksId)
        ]);

        if (!estimateData) continue;

        const estimateAmount = estimateData.totalEstimateAmount;
        const measurementAmount = measurementData?.totalAmount || 0;
        const difference = measurementAmount - estimateAmount;
        const percentageVariance = estimateAmount > 0 ? (difference / estimateAmount) * 100 : 0;

        let status: 'over' | 'under' | 'equal' = 'equal';
        if (difference > 0) status = 'over';
        else if (difference < 0) status = 'under';

        // Calculate subwork-level comparisons
        const subworkDetails: SubworkComparison[] = [];
        
        for (const subwork of estimateData.subworks) {
          const subworkItems = estimateData.subworkItems[subwork.subworks_id] || [];
          const subworkEstimateAmount = subworkItems.reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
          const subworkMeasurementAmount = measurementData?.subworkAmounts[subwork.subworks_id] || 0;
          const subworkDifference = subworkMeasurementAmount - subworkEstimateAmount;
          const subworkPercentageVariance = subworkEstimateAmount > 0 ? (subworkDifference / subworkEstimateAmount) * 100 : 0;
          
          let subworkStatus: 'over' | 'under' | 'equal' = 'equal';
          if (subworkDifference > 0) subworkStatus = 'over';
          else if (subworkDifference < 0) subworkStatus = 'under';

          // Fetch measurement details if there are measurements
          let measurementDetails: MeasurementDetail[] = [];
          if (subworkMeasurementAmount > 0) {
            measurementDetails = await fetchDetailedMeasurementData(subwork.subworks_id);
          }

          // Get changed items for this subwork
          const changedItems = measurementData?.changedItemsBySubwork[subwork.subworks_id] || [];

          subworkDetails.push({
            subworkId: subwork.subworks_id,
            subworkName: subwork.subworks_name,
            estimateAmount: subworkEstimateAmount,
            measurementAmount: subworkMeasurementAmount,
            difference: subworkDifference,
            percentageVariance: subworkPercentageVariance,
            status: subworkStatus,
            measurementDetails,
            changedItems
          });
        }

        results.push({
          worksId,
          workName: work.work_name,
          estimateAmount,
          measurementAmount,
          difference,
          percentageVariance,
          status,
          subworkDetails
        });
      }

      setComparisonResults(results);
    } catch (error) {
      console.error('Error performing comparison:', error);
    } finally {
      setComparing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const handleWorkSelection = (worksId: string) => {
    setSelectedWorksIds(prev => {
      if (prev.includes(worksId)) {
        return prev.filter(id => id !== worksId);
      } else if (prev.length < 3) { // Limit to 3 works for comparison
        return [...prev, worksId];
      }
      return prev;
    });
  };

  const getVarianceIcon = (status: 'over' | 'under' | 'equal') => {
    switch (status) {
      case 'over':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'under':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <Check className="w-4 h-4 text-blue-500" />;
    }
  };

  const getVarianceColor = (status: 'over' | 'under' | 'equal') => {
    switch (status) {
      case 'over':
        return 'text-red-600';
      case 'under':
        return 'text-green-600';
      default:
        return 'text-blue-600';
    }
  };

  if (loading) {
    return <LoadingSpinner text={t('common.loading')} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 via-red-600 to-pink-700 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
        <div className="px-8 py-6">
          <div className="flex items-center">
            <div className="p-3 bg-white/20 rounded-2xl mr-4 shadow-lg">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                Estimate vs Measurement Book Comparison
              </h1>
              <p className="text-orange-100 text-sm mt-1">Compare estimates with actual measurement book data by Works ID</p>
            </div>
          </div>
        </div>
      </div>

      {/* Work Selection */}
      <div className="bg-gradient-to-br from-white to-slate-50 shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-red-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-white/20 rounded-lg mr-3">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-white">Select Works to Compare (Max 3)</h2>
            </div>
            <button
              onClick={performComparison}
              disabled={selectedWorksIds.length === 0 || comparing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-white/20 hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200 disabled:opacity-50 hover:scale-105"
            >
              {comparing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Comparing...
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Compare Selected ({selectedWorksIds.length})
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {works.map((work) => (
              <div
                key={work.works_id}
                className={`relative border rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:scale-105 ${
                  selectedWorksIds.includes(work.works_id)
                    ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 shadow-lg'
                    : 'border-gray-200 hover:border-orange-300 hover:bg-gradient-to-br hover:from-orange-50 hover:to-red-50 hover:shadow-md'
                }`}
                onClick={() => handleWorkSelection(work.works_id)}
              >
                {selectedWorksIds.includes(work.works_id) && (
                  <div className="absolute top-2 right-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {work.works_id}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {work.work_name}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(work.total_estimated_cost)}
                    </span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      work.status === 'approved' ? 'bg-green-100 text-green-800' :
                      work.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {work.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Results */}
      {comparisonResults.length > 0 && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl shadow-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-white/20 rounded-lg mr-3">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-white">Comparison Results</h2>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {comparisonResults.map((result, index) => {
              return (
                <div key={result.worksId} className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-base font-bold text-gray-900 truncate">
                      {result.worksId}
                    </h3>
                    <div className="flex items-center">
                      {getVarianceIcon(result.status)}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{result.workName}</p>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-500">Estimate Amount</p>
                      <p className="text-lg font-bold text-blue-600">
                        {formatCurrency(result.estimateAmount)}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-gray-500">Measurement Book Total</p>
                      <p className="text-lg font-bold text-purple-600">
                        {formatCurrency(result.measurementAmount)}
                      </p>
                    </div>
                    
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Variance</span>
                        <div className="flex items-center">
                          <span className={`text-sm font-bold ${getVarianceColor(result.status)}`}>
                            {result.percentageVariance > 0 ? '+' : ''}{result.percentageVariance.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <p className={`text-sm mt-1 font-medium ${getVarianceColor(result.status)}`}>
                        {formatCurrency(Math.abs(result.difference))} 
                        {result.status === 'over' ? ' over estimate' : 
                         result.status === 'under' ? ' under estimate' : ' exact match'}
                      </p>
                    </div>
                    
                    {/* Show subwork count */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => setExpandedWork(expandedWork === result.worksId ? null : result.worksId)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {expandedWork === result.worksId ? 'Hide' : 'Show'} Subwork Details ({result.subworkDetails.length})
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expanded Subwork Details */}
          {expandedWork && (
            <div className="bg-gradient-to-br from-white to-slate-50 shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-teal-500 to-cyan-600">
                <h3 className="text-lg font-semibold text-white">
                  Subwork Details - {comparisonResults.find(r => r.worksId === expandedWork)?.worksId}
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {comparisonResults
                    .find(r => r.worksId === expandedWork)
                    ?.subworkDetails.map((subwork) => (
                    <div key={subwork.subworkId} className="bg-gradient-to-r from-gray-50 to-slate-100 rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-900">{subwork.subworkId}</h4>
                        <div className="flex items-center">
                          {getVarianceIcon(subwork.status)}
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-600 mb-3 line-clamp-1">{subwork.subworkName}</p>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-gray-500">Original</p>
                          <p className="font-bold text-blue-600">{formatCurrency(subwork.estimateAmount)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Revised</p>
                          <p className="font-bold text-purple-600">{formatCurrency(subwork.measurementAmount)}</p>
                        </div>
                      </div>

                      {/* Show changed items if any */}
                      {subwork.changedItems && subwork.changedItems.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-700 mb-2">
                            {subwork.changedItems.length} Item{subwork.changedItems.length > 1 ? 's' : ''} Changed
                          </p>
                          <div className="space-y-2">
                            {subwork.changedItems.map((item) => (
                              <div key={item.itemId} className="bg-white rounded-lg p-2 text-xs">
                                <p className="text-gray-700 font-medium line-clamp-1 mb-1">{item.description}</p>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <p className="text-gray-400">Original</p>
                                    <p className="font-semibold text-gray-700">{formatCurrency(item.originalEstimate)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400">Revised</p>
                                    <p className="font-semibold text-gray-700">{formatCurrency(item.revisedAmount)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400">Change</p>
                                    <p className={`font-semibold ${item.change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {item.change > 0 ? '+' : ''}{formatCurrency(item.change)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Variance</span>
                          <div className="flex items-center">
                            <span className={`text-xs font-bold ${getVarianceColor(subwork.status)}`}>
                              {subwork.percentageVariance > 0 ? '+' : ''}{subwork.percentageVariance.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <p className={`text-xs mt-1 font-medium ${getVarianceColor(subwork.status)}`}>
                          {formatCurrency(Math.abs(subwork.difference))} 
                          {subwork.status === 'over' ? ' over' : 
                           subwork.status === 'under' ? ' under' : ' exact'}
                        </p>
                      </div>
                      
                      {/* Show measurement details button if there are measurements */}
                      {subwork.measurementAmount > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <button
                            onClick={() => setExpandedSubwork(expandedSubwork === subwork.subworkId ? null : subwork.subworkId)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            {expandedSubwork === subwork.subworkId ? 'Hide' : 'Show'} Measurement Details
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Expanded Measurement Details */}
          {expandedSubwork && (
            <div className="bg-gradient-to-br from-white to-slate-50 shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600">
                <h3 className="text-lg font-semibold text-white">
                  Measurement Details - {comparisonResults
                    .flatMap(r => r.subworkDetails)
                    .find(s => s.subworkId === expandedSubwork)?.subworkId}
                </h3>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-gray-50 to-slate-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Item Description
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Measurement Description
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Unit
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {comparisonResults
                        .flatMap(r => r.subworkDetails)
                        .find(s => s.subworkId === expandedSubwork)
                        ?.measurementDetails?.map((measurement) => (
                        <tr key={measurement.id} className="hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {measurement.itemDescription}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {measurement.description}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-center">
                            {measurement.quantity.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-center">
                            {measurement.unit}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-purple-600">
                            {formatCurrency(measurement.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {/* Detailed Comparison Table */}
          <div className="bg-gradient-to-br from-white to-slate-50 shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-blue-600">
              <h3 className="text-lg font-semibold text-white">Detailed Comparison Report</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-slate-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Works ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Work Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Estimate Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Measurement Book Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Difference
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Variance %
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Subworks
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {comparisonResults.map((result) => {
                    return (
                      <tr key={result.worksId} className="hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 transition-all duration-200">
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-gray-900">{result.worksId}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">{result.workName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                          {formatCurrency(result.estimateAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-600">
                          {formatCurrency(result.measurementAmount)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${getVarianceColor(result.status)}`}>
                          {result.difference > 0 ? '+' : ''}{formatCurrency(result.difference)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getVarianceIcon(result.status)}
                            <span className={`ml-2 text-sm font-bold ${getVarianceColor(result.status)}`}>
                              {result.percentageVariance > 0 ? '+' : ''}{result.percentageVariance.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => setExpandedWork(expandedWork === result.worksId ? null : result.worksId)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View ({result.subworkDetails.length})
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedWorksIds.length === 0 && comparisonResults.length === 0 && (
        <div className="text-center py-16 bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-orange-100 to-red-200 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
            <BarChart3 className="h-10 w-10 text-orange-600" />
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No works selected for comparison</h3>
          <p className="mt-1 text-sm text-gray-500">
            Select works above to compare estimates with measurement book data.
          </p>
        </div>
      )}
    </div>
  );
};

export default Compare;