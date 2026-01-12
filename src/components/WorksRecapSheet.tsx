import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem, TaxEntry, RecapCalculations } from '../types';
import { Plus, Trash2, Save, Check } from 'lucide-react';

interface WorksRecapSheetProps {
  workId: string;
  onCalculationsChange?: (calculations: RecapCalculations, taxes: TaxEntry[]) => void;
  onSave?: (calculations: RecapCalculations, taxes: TaxEntry[]) => void;
  readonly?: boolean;
  unitInputs?: { [subworkId: string]: number };
  onUnitChange?: (subworkId: string, value: number) => void;
  setShowPdfModal?: (value: boolean) => void;
}

const WorksRecapSheet: React.FC<WorksRecapSheetProps> = ({
  workId,
  onCalculationsChange,
  onSave,
  readonly = false,
  unitInputs: externalUnitInputs,
  onUnitChange,
  setShowPdfModal,
}) => {
  const [work, setWork] = useState<Work | null>(null);
  const [subworks, setSubworks] = useState<SubWork[]>([]);
  const [subworkItems, setSubworkItems] = useState<{ [subworkId: string]: SubworkItem[] }>({});
  const [subworkTotals, setSubworkTotals] = useState<Record<string, { regular: number; royalty: number; testing: number }>>({});
  const [loading, setLoading] = useState(true);
  const [taxes, setTaxes] = useState<TaxEntry[]>([
    { id: '1', name: 'GST', type: 'percentage', percentage: 18, applyTo: 'part_b' },
  ]);
  const [calculations, setCalculations] = useState<RecapCalculations | null>(null);
  const [saved, setSaved] = useState(false);

  const [localUnitInputs, setLocalUnitInputs] = useState<{ [subworkId: string]: number }>({});
  const unitInputs = externalUnitInputs ?? localUnitInputs;

  const handleUnitChange = (subworkId: string, value: string) => {
    const num = parseFloat(value) || 0;
    if (onUnitChange) {
      onUnitChange(subworkId, num);
    } else {
      setLocalUnitInputs(prev => ({ ...prev, [subworkId]: num }));
    }
    setSaved(false);
  };

  useEffect(() => {
    if (workId) fetchWorkData();
  }, [workId]);

  useEffect(() => {
    if (work && subworks.length > 0) calculateRecap();
  }, [work, subworks, subworkItems, subworkTotals, taxes, unitInputs]);

const fetchSubworkTotals = async (subworksData: SubWork[], itemsMap: { [subworkId: string]: SubworkItem[] }) => {
  try {
    const totals: Record<string, { regular: number; royalty: number; testing: number }> = {};

    if (!subworksData || subworksData.length === 0) return totals;

    const subworkIds = subworksData.map(sw => sw.subworks_id);
    const subworkSrNos = subworksData.map(sw => sw.sr_no);

    const subworkIdToSrNo: Record<string, number> = {};
    const subworkSrNoToId: Record<number, string> = {};
    subworksData.forEach(sw => {
      subworkIdToSrNo[sw.subworks_id] = sw.sr_no;
      subworkSrNoToId[sw.sr_no] = sw.subworks_id;
    });

    const allSubworkItems = Object.values(itemsMap).flat();

    if (allSubworkItems.length === 0) {
      subworksData.forEach(subwork => {
        totals[subwork.subworks_id] = { regular: 0, royalty: 0, testing: 0 };
      });
      return totals;
    }

    const itemSrNos = allSubworkItems.map(i => i.sr_no).filter(sr => sr);

    const { data: rateRows } = await supabase
      .schema('estimate')
      .from('item_rates')
      .select('subwork_item_sr_no, rate, rate_total_amount, description')
      .in('subwork_item_sr_no', itemSrNos);

    const { data: royaltyMeasurements } = await supabase
      .schema('estimate')
      .from('royalty_measurements')
      .select('subwork_id, hb_metal, murum, sand')
      .in('subwork_id', subworkSrNos);

    const { data: testingMeasurements } = await supabase
      .schema('estimate')
      .from('testing_measurements')
      .select('subwork_item_id, required_tests')
      .in('subwork_item_id', itemSrNos);

    const royaltyTotalsPerSubwork: Record<string, { hb_metal: number; murum: number; sand: number }> = {};
    (royaltyMeasurements || []).forEach(measurement => {
      const subworkSrNo = measurement.subwork_id;
      const subworkId = subworkSrNoToId[subworkSrNo];
      if (!subworkId) return;

      if (!royaltyTotalsPerSubwork[subworkId]) {
        royaltyTotalsPerSubwork[subworkId] = { hb_metal: 0, murum: 0, sand: 0 };
      }
      royaltyTotalsPerSubwork[subworkId].hb_metal += Number(measurement.hb_metal) || 0;
      royaltyTotalsPerSubwork[subworkId].murum += Number(measurement.murum) || 0;
      royaltyTotalsPerSubwork[subworkId].sand += Number(measurement.sand) || 0;
    });

    const testingTotalsPerItem: Record<number, number> = {};
    (testingMeasurements || []).forEach(measurement => {
      testingTotalsPerItem[measurement.subwork_item_id] = Number(measurement.required_tests) || 0;
    });

    subworkIds.forEach(id => {
      totals[id] = { regular: 0, royalty: 0, testing: 0 };
    });

    allSubworkItems.forEach(item => {
      const subworkId = item.subwork_id;
      const category = item.category;
      const itemRates = (rateRows || []).filter(r => r.subwork_item_sr_no === item.sr_no);

      if (!totals[subworkId]) {
        totals[subworkId] = { regular: 0, royalty: 0, testing: 0 };
      }

      let totalItemAmt = 0;

      if (category === 'royalty' && royaltyTotalsPerSubwork[subworkId]) {
        const royaltyData = royaltyTotalsPerSubwork[subworkId];
        itemRates.forEach(rate => {
          const rateDesc = (rate.description || '').toLowerCase();
          let quantity = 0;
          if (rateDesc.includes('metal')) {
            quantity = royaltyData.hb_metal;
          } else if (rateDesc.includes('murum')) {
            quantity = royaltyData.murum;
          } else if (rateDesc.includes('sand')) {
            quantity = royaltyData.sand;
          }
          totalItemAmt += quantity * Number(rate.rate || 0);
        });
        totals[subworkId].royalty += totalItemAmt;
      } else if (category === 'testing' && item.sr_no && testingTotalsPerItem[item.sr_no]) {
        const testingQty = testingTotalsPerItem[item.sr_no];
        itemRates.forEach(rate => {
          totalItemAmt += testingQty * Number(rate.rate || 0);
        });
        totals[subworkId].testing += totalItemAmt;
      } else {
        totalItemAmt = itemRates.reduce((sum, rate) => sum + (Number(rate.rate_total_amount) || 0), 0);
        totals[subworkId].regular += totalItemAmt;
      }
    });

    return totals;
  } catch (error) {
    console.error('Error fetching subwork totals:', error);
    return {};
  }
};

const fetchWorkData = async () => {
  try {
    setLoading(true);
    const { data: workData, error: workError } = await supabase
      .schema('estimate')
      .from('works')
      .select('*')
      .eq('works_id', workId)
      .single();

    if (workError) throw workError;

    // Always parse taxes and unitInputs from recap_json if present,
    // but ALWAYS fetch subworks/items fresh from DB to ensure latest shown!
    if (workData?.recap_json) {
      const recapJsonData = JSON.parse(workData.recap_json);

      setWork(recapJsonData.work || workData);

      // Always fresh fetch subworks
      const { data: subworksData, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', workId)
        .order('sr_no');

      if (subworksError) throw subworksError;
      setSubworks(subworksData || []);

      const itemsMap: { [subworkId: string]: SubworkItem[] } = {};
      for (const subwork of subworksData || []) {
        const { data: items } = await supabase
          .schema('estimate')
          .from('subwork_items')
          .select('*')
          .eq('subwork_id', subwork.subworks_id)
          .order('sr_no');
        itemsMap[subwork.subworks_id] = Array.isArray(items) ? items : [];
      }
      setSubworkItems(itemsMap);

      const totals = await fetchSubworkTotals(subworksData || [], itemsMap);
      setSubworkTotals(totals);

      if (recapJsonData.taxes) {
        const migratedTaxes = recapJsonData.taxes.map((tax: any) => ({
          ...tax,
          type: tax.type || 'percentage',
          percentage: tax.percentage || 0,
        }));
        setTaxes(migratedTaxes);
      } else {
        setTaxes([{ id: '1', name: 'GST', type: 'percentage', percentage: 18, applyTo: 'part_b' }]);
      }

      if (recapJsonData.unitInputs) {
        setLocalUnitInputs(recapJsonData.unitInputs);
      } else {
        setLocalUnitInputs({});
      }
    } else {
      // If no recap_json, fallback to normal fetching (already correct)
      setWork(workData);

      const { data: subworksData, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', workId)
        .order('sr_no');

      if (subworksError) throw subworksError;
      setSubworks(subworksData || []);

      const itemsMap: { [subworkId: string]: SubworkItem[] } = {};
      for (const subwork of subworksData || []) {
        const { data: items } = await supabase
          .schema('estimate')
          .from('subwork_items')
          .select('*')
          .eq('subwork_id', subwork.subworks_id)
          .order('sr_no');
        itemsMap[subwork.subworks_id] = Array.isArray(items) ? items : [];
      }
      setSubworkItems(itemsMap);

      const totals = await fetchSubworkTotals(subworksData || [], itemsMap);
      setSubworkTotals(totals);
    }
  } catch (error) {
    console.error('Error fetching work data:', error);
  } finally {
    setLoading(false);
  }
};


  const calculateRecap = () => {
    let partASubtotal = 0;
    let partBSubtotal = 0;
    let partCSubtotal = 0;

    subworks.forEach(subwork => {
      const inputUnit = unitInputs[subwork.subworks_id] ?? (Number(subwork.unit) || 1);
      const subworkTotal = subworkTotals[subwork.subworks_id];

      if (subworkTotal) {
        partASubtotal += (subworkTotal.regular || 0) * inputUnit;
        partBSubtotal += ((subworkTotal.royalty || 0) + (subworkTotal.testing || 0)) * inputUnit;
      } else {
        const items = subworkItems[subwork.subworks_id] || [];
        const subworkTotalAmt = items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
        const rowTotal = subworkTotalAmt * inputUnit;

        const isPartA = items.some(item => !item.category || item.category === '');
        const isPartB = items.some(item => item.category === 'royalty' || item.category === 'testing');
        const isPartC = items.some(item => item.category === 'With GST' || item.category === 'materials' || item.category === 'purchasing');

        if (isPartA) partASubtotal += rowTotal;
        if (isPartB) partBSubtotal += rowTotal;
        if (isPartC) partCSubtotal += rowTotal;
      }
    });

    const calculateTaxes = (subtotal: number, applyToPart: 'part_a' | 'part_b' | 'part_c') => {
      const applicableTaxes = taxes.filter(
        tax => tax.applyTo === applyToPart || tax.applyTo === 'both'
      );
      const taxAmounts: { [taxId: string]: number } = {};
      applicableTaxes.forEach(tax => {
        if (tax.type === 'fixed') {
          taxAmounts[tax.id] = tax.fixedAmount || 0;
        } else {
          taxAmounts[tax.id] = (subtotal * (tax.percentage || 0)) / 100;
        }
      });
      return taxAmounts;
    };

    const partATaxes = calculateTaxes(partASubtotal, 'part_a');
    const partBTaxes = calculateTaxes(partBSubtotal, 'part_b');
    const partCTaxes = calculateTaxes(partCSubtotal, 'part_c');
    const partATaxTotal = Object.values(partATaxes).reduce((sum, val) => sum + val, 0);
    const partBTaxTotal = Object.values(partBTaxes).reduce((sum, val) => sum + val, 0);
    const partCTaxTotal = Object.values(partCTaxes).reduce((sum, val) => sum + val, 0);

    const partATotal = partASubtotal + partATaxTotal;
    const partBTotal = partBSubtotal + partBTaxTotal;
    const partCTotal = partCSubtotal + partCTaxTotal;

    const partABCombinedSubtotal = partATotal + partBTotal;

    const partABCombinedTaxes = taxes.filter(tax => tax.applyTo === 'part_a_b_combined');
    const partABCombinedTaxAmounts: { [taxId: string]: number } = {};
    partABCombinedTaxes.forEach(tax => {
      if (tax.type === 'fixed') {
        partABCombinedTaxAmounts[tax.id] = tax.fixedAmount || 0;
      } else {
        partABCombinedTaxAmounts[tax.id] = (partABCombinedSubtotal * (tax.percentage || 0)) / 100;
      }
    });
    const partABCombinedTaxTotal = Object.values(partABCombinedTaxAmounts).reduce((sum, val) => sum + val, 0);

    const contingencies = partATotal * 0.005;
    const inspectionCharges = partATotal * 0.005;
    const dprCharges = Math.min(partATotal * 0.05, 100000);

    const grandTotal = partABCombinedSubtotal + partABCombinedTaxTotal + partCTotal + dprCharges;

    const calculationsResult: RecapCalculations = {
      partA: { subtotal: partASubtotal, taxes: partATaxes, total: partATotal },
      partB: { subtotal: partBSubtotal, taxes: partBTaxes, total: partBTotal },
      partC: { subtotal: partCSubtotal, taxes: partCTaxes, total: partCTotal },
      partABCombined: { subtotal: partABCombinedSubtotal, taxes: partABCombinedTaxAmounts, total: partABCombinedSubtotal + partABCombinedTaxTotal },
      additionalCharges: { contingencies, inspectionCharges, dprCharges },
      grandTotal,
    };

    setCalculations(calculationsResult);
    if (onCalculationsChange) onCalculationsChange(calculationsResult, taxes);
  };

  const addTax = () => {
    const newTax: TaxEntry = {
      id: Date.now().toString(),
      name: 'New Tax',
      type: 'percentage',
      percentage: 0,
      applyTo: 'both',
    };
    setTaxes([...taxes, newTax]);
    setSaved(false);
  };

  const updateTax = (id: string, field: keyof TaxEntry, value: any) => {
    setTaxes(taxes.map(tax => (tax.id === id ? { ...tax, [field]: value } : tax)));
    setSaved(false);
  };

  const updateTaxType = (id: string, newType: 'percentage' | 'fixed') => {
    setTaxes(taxes.map(tax => {
      if (tax.id === id) {
        if (newType === 'percentage') {
          return { ...tax, type: 'percentage', fixedAmount: undefined, percentage: 0 };
        } else {
          return { ...tax, type: 'fixed', percentage: undefined, fixedAmount: 0 };
        }
      }
      return tax;
    }));
    setSaved(false);
  };

  const removeTax = (id: string) => {
    setTaxes(taxes.filter(tax => tax.id !== id));
    setSaved(false);
  };

const handleSave = async () => {
  if (calculations && onSave) {
    onSave(calculations, taxes);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  try {
    // 1️⃣ Fetch existing work (already allowed by SELECT policy)
    const { data: workData, error: fetchError } = await supabase
      .schema('estimate')
      .from('works')
      .select('type, work_name')
      .eq('works_id', workId)
      .single();

    if (fetchError) throw fetchError;

    const recapData = {
      workId,
      work,
      type: workData.type,
      work_name: workData.work_name,
      subworks,
      subworkItems,
      taxes,
      calculations,
      unitInputs,
      savedAt: new Date().toISOString(),
    };

    // 2️⃣ UPDATE ONLY (no insert → no RLS violation)
    const { error: updateError } = await supabase
      .schema('estimate')
      .from('works')
      .update({
        recap_json: JSON.stringify(recapData),
        total_estimated_cost:
          (calculations.partA.subtotal || 0) +
          (calculations.partB.subtotal || 0) +
          (calculations.partC.subtotal || 0),
        updated_at: new Date().toISOString(),
      })
      .eq('works_id', workId);

    if (updateError) throw updateError;

    console.log('✅ Recap data updated successfully');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setShowPdfModal?.(false);

  } catch (error) {
    console.error('❌ Error saving recap data:', error);
  }
};


  const getPartASubworks = () => {
    return subworks.filter(subwork => {
      const items = subworkItems[subwork.subworks_id] || [];
      return items.some(item => !item.category || item.category === '');
    });
  };

  const getPartBSubworks = () => {
    return subworks.filter(subwork => {
      const items = subworkItems[subwork.subworks_id] || [];
      return items.some(item => item.category === 'royalty' || item.category === 'testing');
    });
  };

  const getRoyaltySubworks = () => {
    return subworks.filter(subwork => {
      const totals = subworkTotals[subwork.subworks_id];
      return totals && totals.royalty > 0;
    });
  };

  const getTestingSubworks = () => {
    return subworks.filter(subwork => {
      const totals = subworkTotals[subwork.subworks_id];
      return totals && totals.testing > 0;
    });
  };

  const getPartCSubworks = () => {
    return subworks.filter(subwork => {
      const items = subworkItems[subwork.subworks_id] || [];
      return items.some(item => item.category === 'With GST' || item.category === 'materials' || item.category === 'purchasing');
    });
  };

  const showFundingCols = true;
  const showTypeColumn = true;
  const baseColumns = showTypeColumn ? 6 : 5;
  const totalColspan = showFundingCols ? baseColumns + 2 : baseColumns;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading recap sheet...</span>
      </div>
    );
  }

  if (!work) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Work not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Work Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">GENERAL ABSTRACT</h2>
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Work:</span> {work.work_name}
          </p>
          <p>
            <span className="font-medium">Fund Head:</span> {work.fund_head || 'N/A'}
          </p>
          <p>
            <span className="font-medium">Village:</span> {work.village}
          </p>
          {!readonly && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={handleSave}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {saved ? (
                  <>
                    <Check className="w-4 h-4 mr-1" /> Saved
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" /> Save
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tax Configuration */}
      {!readonly && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Tax Configuration</h3>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSave}
                disabled={!calculations}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saved ? (
                  <>
                    <Check className="w-4 h-4 mr-1" /> Saved
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" /> Save
                  </>
                )}
              </button>
              <button
                onClick={addTax}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Tax
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {taxes.map(tax => (
              <div key={tax.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded">
                <input
                  type="text"
                  value={tax.name}
                  onChange={(e) => updateTax(tax.id, 'name', e.target.value)}
                  placeholder="Tax Name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <select
                  value={tax.type || 'percentage'}
                  onChange={(e) => {
                    const newType = e.target.value as 'percentage' | 'fixed';
                    updateTaxType(tax.id, newType);
                  }}
                  className="w-32 px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
                {tax.type === 'fixed' ? (
                  <input
                    type="number"
                    value={tax.fixedAmount || 0}
                    onChange={(e) => updateTax(tax.id, 'fixedAmount', parseFloat(e.target.value) || 0)}
                    placeholder="Amount"
                    className="w-32 px-3 py-2 border border-gray-300 rounded text-sm"
                    step="0.01"
                  />
                ) : (
                  <input
                    type="number"
                    value={tax.percentage || 0}
                    onChange={(e) => updateTax(tax.id, 'percentage', parseFloat(e.target.value) || 0)}
                    placeholder="Percentage"
                    className="w-24 px-3 py-2 border border-gray-300 rounded text-sm"
                    step="0.01"
                  />
                )}
                <select
                  value={tax.applyTo}
                  onChange={(e) => updateTax(tax.id, 'applyTo', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="part_a">Part A Only</option>
                  <option value="part_b">Part B Only</option>
                  <option value="part_c">Part C Only</option>
                  <option value="part_a_b_combined">Part A+B Combined</option>
                  <option value="both">All Parts</option>
                </select>
                <button
                  onClick={() => removeTax(tax.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recap Table */}
      {calculations && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Summary</h3>

            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-3 min-w-[40px] text-center">Sr. No</th>
                  {showTypeColumn && (
                    <th className="border border-gray-300 p-3 min-w-[120px]">Type of Work</th>
                  )}
                  <th className="border border-gray-300 p-3 min-w-[200px]">Item of Work</th>
                  <th className="border border-gray-300 p-3 min-w-[60px] text-right">Unit</th>
                  <th className="border border-gray-300 p-3 min-w-[110px] text-right">Amount per unit(Rs.)</th>
                  <th className="border border-gray-300 p-3 min-w-[110px] text-right">Total Amount (Rs.)</th>
                  {showFundingCols && (
                    <>
                      <th className="border border-gray-300 p-3 min-w-[100px] text-right">SBM (G) (70%)</th>
                      <th className="border border-gray-300 p-3 min-w-[100px] text-right">15th FC (30%)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {/* PART A Rows */}
                <tr className="bg-gray-200 font-bold">
                  <td colSpan={totalColspan} className="border border-gray-300 p-3">
                    PART-A: Works
                  </td>
                </tr>
                {getPartASubworks().map((subwork, index) => {
                  const items = (subworkItems[subwork.subworks_id] || []).filter(
                    item => !item.category || item.category === ''
                  );
                  const subworkTotalAmount = items.reduce(
                    (sum, item) => sum + (item.total_item_amount || 0),
                    0
                  );

                  const inputUnit = unitInputs[subwork.subworks_id] ?? (Number(subwork.unit) || 1);
                  const totalAmount = inputUnit * subworkTotalAmount;

                  return (
                    <tr key={`part-a-${subwork.subworks_id}`}>
                      <td className="border border-gray-300 p-3 text-center">{index + 1}</td>
                      {showTypeColumn && (
                        <td className="border border-gray-300 p-3">Solid waste management</td>
                      )}
                      <td className="border border-gray-300 p-3">{subwork.subworks_name}</td>
                      {readonly ? (
                        <td className="border border-gray-300 p-3 text-right">{inputUnit}</td>
                      ) : (
                        <td className="border border-gray-300 p-3 text-right">
                          <input
                            type="number"
                            className="w-20 px-1 py-1 border border-gray-300 rounded"
                            value={inputUnit}
                            min="0"
                            step="any"
                            onChange={(e) => handleUnitChange(subwork.subworks_id, e.target.value)}
                          />
                        </td>
                      )}
                      <td className="border border-gray-300 p-3 text-right">{subworkTotalAmount.toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{totalAmount.toFixed(0)}</td>
                      {showFundingCols && (
                        <>
                          <td className="border border-gray-300 p-3 text-right">{(totalAmount * 0.7).toFixed(0)}</td>
                          <td className="border border-gray-300 p-3 text-right">{(totalAmount * 0.3).toFixed(0)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
                <tr className="font-bold bg-blue-50">
                  <td colSpan={showTypeColumn ? 5 : 4} className="border border-gray-300 p-3 text-right">Subtotal - Part A</td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.partA.subtotal.toFixed(0)}</td>
                  {showFundingCols && (
                    <>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.partA.subtotal * 0.7).toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.partA.subtotal * 0.3).toFixed(0)}</td>
                    </>
                  )}
                </tr>
                {taxes
                  .filter((tax) => tax.applyTo === 'part_a' || tax.applyTo === 'both')
                  .map((tax) => (
                    <tr key={`part-a-tax-${tax.id}`} className="font-semibold">
                      <td colSpan={showTypeColumn ? 5 : 4} className="border border-gray-300 p-3 text-right">
                        {tax.type === 'fixed' ? `Add ₹${tax.fixedAmount || 0} ${tax.name}` : `Add ${tax.percentage}% ${tax.name}`}
                      </td>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.partA.taxes[tax.id] || 0).toFixed(0)}</td>
                      {showFundingCols && (
                        <>
                          <td className="border border-gray-300 p-3 text-right">{((calculations.partA.taxes[tax.id] || 0) * 0.7).toFixed(0)}</td>
                          <td className="border border-gray-300 p-3 text-right">{((calculations.partA.taxes[tax.id] || 0) * 0.3).toFixed(0)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                <tr className="font-bold bg-blue-100">
                  <td colSpan={showTypeColumn ? 5 : 4} className="border border-gray-300 p-3 text-right">Total of PART - A</td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.partA.total.toFixed(0)}</td>
                  {showFundingCols && (
                    <>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.partA.total * 0.7).toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.partA.total * 0.3).toFixed(0)}</td>
                    </>
                  )}
                </tr>

                {/* Royalty Rows */}
                {getRoyaltySubworks().length > 0 && (
                  <>
                    <tr className="bg-amber-100 font-bold">
                      <td colSpan={totalColspan} className="border border-gray-300 p-3">
                        Royalty Charges
                      </td>
                    </tr>
                    {getRoyaltySubworks().map((subwork, index) => {
                      const totals = subworkTotals[subwork.subworks_id];
                      const subworkRoyaltyAmount = totals?.royalty || 0;

                      const inputUnit = unitInputs[subwork.subworks_id] ?? (Number(subwork.unit) || 1);
                      const totalAmount = inputUnit * subworkRoyaltyAmount;

                      return (
                        <tr key={`royalty-${subwork.subworks_id}`}>
                          <td className="border border-gray-300 p-3 text-center">{index + 1}</td>
                          {showTypeColumn && (
                            <td className="border border-gray-300 p-3">Royalty</td>
                          )}
                          <td className="border border-gray-300 p-3">{subwork.subworks_name}</td>
                          {readonly ? (
                            <td className="border border-gray-300 p-3 text-right">{inputUnit}</td>
                          ) : (
                            <td className="border border-gray-300 p-3 text-right">
                              <input
                                type="number"
                                className="w-20 px-1 py-1 border border-gray-300 rounded"
                                value={inputUnit}
                                min="0"
                                step="any"
                                onChange={(e) => handleUnitChange(subwork.subworks_id, e.target.value)}
                              />
                            </td>
                          )}
                          <td className="border border-gray-300 p-3 text-right">{subworkRoyaltyAmount.toFixed(0)}</td>
                          <td className="border border-gray-300 p-3 text-right">{totalAmount.toFixed(0)}</td>
                          {showFundingCols && (
                            <>
                              <td className="border border-gray-300 p-3 text-right">{(totalAmount * 0.7).toFixed(0)}</td>
                              <td className="border border-gray-300 p-3 text-right">{(totalAmount * 0.3).toFixed(0)}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </>
                )}

                {/* Testing Rows */}
                {getTestingSubworks().length > 0 && (
                  <>
                    <tr className="bg-purple-100 font-bold">
                      <td colSpan={totalColspan} className="border border-gray-300 p-3">
                        Testing Charges
                      </td>
                    </tr>
                    {getTestingSubworks().map((subwork, index) => {
                      const totals = subworkTotals[subwork.subworks_id];
                      const subworkTestingAmount = totals?.testing || 0;

                      const inputUnit = unitInputs[subwork.subworks_id] ?? (Number(subwork.unit) || 1);
                      const totalAmount = inputUnit * subworkTestingAmount;

                      return (
                        <tr key={`testing-${subwork.subworks_id}`}>
                          <td className="border border-gray-300 p-3 text-center">{index + 1}</td>
                          {showTypeColumn && (
                            <td className="border border-gray-300 p-3">Testing</td>
                          )}
                          <td className="border border-gray-300 p-3">{subwork.subworks_name}</td>
                          {readonly ? (
                            <td className="border border-gray-300 p-3 text-right">{inputUnit}</td>
                          ) : (
                            <td className="border border-gray-300 p-3 text-right">
                              <input
                                type="number"
                                className="w-20 px-1 py-1 border border-gray-300 rounded"
                                value={inputUnit}
                                min="0"
                                step="any"
                                onChange={(e) => handleUnitChange(subwork.subworks_id, e.target.value)}
                              />
                            </td>
                          )}
                          <td className="border border-gray-300 p-3 text-right">{subworkTestingAmount.toFixed(0)}</td>
                          <td className="border border-gray-300 p-3 text-right">{totalAmount.toFixed(0)}</td>
                          {showFundingCols && (
                            <>
                              <td className="border border-gray-300 p-3 text-right">{(totalAmount * 0.7).toFixed(0)}</td>
                              <td className="border border-gray-300 p-3 text-right">{(totalAmount * 0.3).toFixed(0)}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </>
                )}
                <tr className="font-bold bg-green-50">
                  <td colSpan={showTypeColumn ? 5 : 4} className="border border-gray-300 p-3 text-right">Subtotal - Part B</td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.partB.subtotal.toFixed(0)}</td>
                  {showFundingCols && (
                    <>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.partB.subtotal * 0.7).toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.partB.subtotal * 0.3).toFixed(0)}</td>
                    </>
                  )}
                </tr>
                {taxes
                  .filter((tax) => tax.applyTo === 'part_b' || tax.applyTo === 'both')
                  .map((tax) => (
                    <tr key={`part-b-tax-${tax.id}`} className="font-semibold">
                      <td colSpan={showTypeColumn ? 5 : 4} className="border border-gray-300 p-3 text-right">
                        {tax.type === 'fixed' ? `Add ₹${tax.fixedAmount || 0} ${tax.name}` : `Add ${tax.percentage}% ${tax.name}`}
                      </td>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.partB.taxes[tax.id] || 0).toFixed(0)}</td>
                      {showFundingCols && (
                        <>
                          <td className="border border-gray-300 p-3 text-right">{((calculations.partB.taxes[tax.id] || 0) * 0.7).toFixed(0)}</td>
                          <td className="border border-gray-300 p-3 text-right">{((calculations.partB.taxes[tax.id] || 0) * 0.3).toFixed(0)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                <tr className="font-bold bg-green-100">
                  <td colSpan={showTypeColumn ? 5 : 4} className="border border-gray-300 p-3 text-right">Total of PART - B</td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.partB.total.toFixed(0)}</td>
                  {showFundingCols && (
                    <>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.partB.total * 0.7).toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.partB.total * 0.3).toFixed(0)}</td>
                    </>
                  )}
                </tr>

                {/* Part A + Part B Combined Summary */}
                {calculations.partABCombined && calculations.partABCombined.subtotal > 0 && (
                  <>
                    <tr className="font-bold bg-teal-50">
                      <td colSpan={showTypeColumn ? 5 : 4} className="border border-gray-300 p-3 text-right">
                        Total of PART A + PART B
                      </td>
                      <td className="border border-gray-300 p-3 text-right">{calculations.partABCombined.subtotal.toFixed(0)}</td>
                      {showFundingCols && (
                        <>
                          <td className="border border-gray-300 p-3 text-right">{(calculations.partABCombined.subtotal * 0.7).toFixed(0)}</td>
                          <td className="border border-gray-300 p-3 text-right">{(calculations.partABCombined.subtotal * 0.3).toFixed(0)}</td>
                        </>
                      )}
                    </tr>
                    {taxes
                      .filter((tax) => tax.applyTo === 'part_a_b_combined')
                      .map((tax) => (
                        <tr key={`combined-tax-${tax.id}`} className="font-semibold">
                          <td colSpan={showTypeColumn ? 5 : 4} className="border border-gray-300 p-3 text-right">
                            {tax.type === 'fixed' ? `Add ₹${tax.fixedAmount || 0} ${tax.name}` : `Add ${tax.percentage}% ${tax.name}`}
                          </td>
                          <td className="border border-gray-300 p-3 text-right">{(calculations.partABCombined.taxes[tax.id] || 0).toFixed(0)}</td>
                          {showFundingCols && (
                            <>
                              <td className="border border-gray-300 p-3 text-right">{((calculations.partABCombined.taxes[tax.id] || 0) * 0.7).toFixed(0)}</td>
                              <td className="border border-gray-300 p-3 text-right">{((calculations.partABCombined.taxes[tax.id] || 0) * 0.3).toFixed(0)}</td>
                            </>
                          )}
                        </tr>
                      ))}
                  </>
                )}

                {/* PART C Rows */}
                {true && (
                  <>
                    <tr className="bg-gray-200 font-bold">
                      <td colSpan={totalColspan} className="border border-gray-300 p-3">
                        PART-C: Purchasing Items including GST & all Taxes
                      </td>
                    </tr>
                    {getPartCSubworks().map((subwork, index) => {
                      const items = (subworkItems[subwork.subworks_id] || []).filter(
                        item => item.category === 'With GST' || item.category === 'materials' || item.category === 'purchasing'
                      );
                      const subworkTotalAmount = items.reduce(
                        (sum, item) => sum + (item.total_item_amount || 0),
                        0
                      );

                      const inputUnit = unitInputs[subwork.subworks_id] ?? (Number(subwork.unit) || 1);
                      const totalAmount = inputUnit * subworkTotalAmount;

                      return (
                        <tr key={`part-c-${subwork.subworks_id}`}>
                          <td className="border border-gray-300 p-3 text-center">{index + 1}</td>
                          {showTypeColumn && (
                            <td className="border border-gray-300 p-3">Solid waste management</td>
                          )}
                          <td className="border border-gray-300 p-3">{subwork.subworks_name}</td>
                          {readonly ? (
                            <td className="border border-gray-300 p-3 text-right">{inputUnit}</td>
                          ) : (
                            <td className="border border-gray-300 p-3 text-right">
                              <input
                                type="number"
                                className="w-20 px-1 py-1 border border-gray-300 rounded"
                                value={inputUnit}
                                min="0"
                                step="any"
                                onChange={(e) => handleUnitChange(subwork.subworks_id, e.target.value)}
                              />
                            </td>
                          )}
                          <td className="border border-gray-300 p-3 text-right">{subworkTotalAmount.toFixed(0)}</td>
                          <td className="border border-gray-300 p-3 text-right">{totalAmount.toFixed(0)}</td>
                          {showFundingCols && (
                            <>
                              <td className="border border-gray-300 p-3 text-right">{(totalAmount * 0.7).toFixed(0)}</td>
                              <td className="border border-gray-300 p-3 text-right">{(totalAmount * 0.3).toFixed(0)}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    <tr className="font-bold bg-purple-50">
                      <td colSpan={showTypeColumn ? 5 : 4} className="border border-gray-300 p-3 text-right">Subtotal - Part C</td>
                      <td className="border border-gray-300 p-3 text-right">{calculations.partC.subtotal.toFixed(0)}</td>
                      {showFundingCols && (
                        <>
                          <td className="border border-gray-300 p-3 text-right">{(calculations.partC.subtotal * 0.7).toFixed(0)}</td>
                          <td className="border border-gray-300 p-3 text-right">{(calculations.partC.subtotal * 0.3).toFixed(0)}</td>
                        </>
                      )}
                    </tr>
                    {taxes
                      .filter((tax) => tax.applyTo === 'part_c' || tax.applyTo === 'both')
                      .map((tax) => (
                        <tr key={`part-c-tax-${tax.id}`} className="font-semibold">
                          <td colSpan={showTypeColumn ? 5 : 4} className="border border-gray-300 p-3 text-right">
                            {tax.type === 'fixed' ? `Add ₹${tax.fixedAmount || 0} ${tax.name}` : `Add ${tax.percentage}% ${tax.name}`}
                          </td>
                          <td className="border border-gray-300 p-3 text-right">{(calculations.partC.taxes[tax.id] || 0).toFixed(0)}</td>
                          {showFundingCols && (
                            <>
                              <td className="border border-gray-300 p-3 text-right">{((calculations.partC.taxes[tax.id] || 0) * 0.7).toFixed(0)}</td>
                              <td className="border border-gray-300 p-3 text-right">{((calculations.partC.taxes[tax.id] || 0) * 0.3).toFixed(0)}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    <tr className="font-bold bg-purple-100">
                      <td colSpan={showTypeColumn ? 5 : 4} className="border border-gray-300 p-3 text-right">Total of PART - C</td>
                      <td className="border border-gray-300 p-3 text-right">{calculations.partC.total.toFixed(0)}</td>
                      {showFundingCols && (
                        <>
                          <td className="border border-gray-300 p-3 text-right">{(calculations.partC.total * 0.7).toFixed(0)}</td>
                          <td className="border border-gray-300 p-3 text-right">{(calculations.partC.total * 0.3).toFixed(0)}</td>
                        </>
                      )}
                    </tr>
                  </>
                )}

                {/* Additional Charges & Grand Total */}
                {true && (
                  <tr className="font-semibold">
                    <td colSpan={showTypeColumn ? 5 : 4} className="border border-gray-300 p-3 text-right">
                      DPR charges 5% or 1 Lakh whichever is less
                    </td>
                    <td className="border border-gray-300 p-3 text-right">
                      {calculations.additionalCharges.dprCharges.toFixed(0)}
                    </td>
                    {showFundingCols && (
                      <>
                        <td className="border border-gray-300 p-3 text-right">
                          {calculations.additionalCharges.dprCharges.toFixed(0)}
                        </td>
                        <td className="border border-gray-300 p-3 text-right">0</td>
                      </>
                    )}
                  </tr>
                )}
                <tr className="font-bold bg-yellow-100 text-lg">
                  <td colSpan={showTypeColumn ? 5 : 4} className="border border-gray-300 p-3 text-right">
                    Gross Total Estimated Amount
                  </td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.grandTotal.toFixed(0)}</td>
                  {showFundingCols && (
                    <>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.grandTotal * 0.7).toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.grandTotal * 0.3).toFixed(0)}</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorksRecapSheet;