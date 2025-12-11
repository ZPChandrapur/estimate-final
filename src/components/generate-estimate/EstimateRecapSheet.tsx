import React from 'react';
import { CompleteEstimateData } from './EstimateSupabaseOperations';
import { RecapCalculations, TaxEntry } from '../../types';

interface EstimateRecapSheetProps {
  estimateData: CompleteEstimateData;
  headerSettings: {
    line1: string;
    line2: string;
    line3: string;
  };
  footerSettings: {
    line1: string;
    line2: string;
  };
  showPageNumbers: boolean;
  pageNumberPosition: string;
  pageNumber: number;
  recapCalculations?: RecapCalculations;
  taxes?: TaxEntry[];
}

export const EstimateRecapSheet: React.FC<EstimateRecapSheetProps> = ({
  estimateData,
  headerSettings,
  footerSettings,
  showPageNumbers,
  pageNumberPosition,
  pageNumber,
  recapCalculations,
  taxes = []
}) => {
  const getPartASubworks = () => {
    return estimateData.subworks.filter(subwork => {
      const items = estimateData.subworkItems[subwork.subworks_id] || [];
      return items.some(item => item.category === 'purchasing' || item.category === 'materials');
    });
  };

  const getPartBSubworks = () => {
    return estimateData.subworks.filter(subwork => {
      const items = estimateData.subworkItems[subwork.subworks_id] || [];
      return items.some(item => item.category === 'construction' || !item.category);
    });
  };

  const calculateSubworkTotal = (subworkId: string) => {
    const items = estimateData.subworkItems[subworkId] || [];
    return items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
  };

  return (
    <div className="page-break bg-white p-8 min-h-screen flex flex-col">
      <div className="text-center mb-6 border-b border-gray-300 pb-4">
        <h1 className="text-xl font-bold text-red-600 mb-1">
          {headerSettings.line1}
        </h1>
        <h2 className="text-base font-semibold text-blue-600 mb-1">
          {headerSettings.line2}
        </h2>
        <h3 className="text-sm text-blue-500">
          {headerSettings.line3}
        </h3>
      </div>

      <div className="flex-1">
        <div className="text-center mb-6">
          <p className="text-sm">Fund Head: {estimateData.work.fund_head || 'SBM (G.) Phase-II & 15th Finance Commission'}</p>
          <p className="text-sm font-semibold">NAME OF WORK: {estimateData.work.work_name}</p>
          <p className="text-sm">Village: {estimateData.work.village}, Tah: {estimateData.work.taluka}</p>
          <h3 className="text-lg font-bold mt-4">RECAPITULATION SHEET</h3>
        </div>

        <table className="w-full border-collapse border border-black text-xs mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 text-center">Sr. No</th>
              <th className="border border-black p-2">Type of work</th>
              <th className="border border-black p-2">Item of Work</th>
              <th className="border border-black p-2">No. of unit</th>
              <th className="border border-black p-2">Amount per unit (Rs.)</th>
              <th className="border border-black p-2">Total Amount (Rs.)</th>
              <th className="border border-black p-2">SBM (G) (70%) (Rs.)</th>
              <th className="border border-black p-2">Convergence-15th Finance Commission (30%) (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-gray-200 font-bold">
              <td colSpan={8} className="border border-black p-2">PART-A: Purchasing Items including GST & all Taxes</td>
            </tr>
            {getPartASubworks().map((subwork, index) => {
              const items = estimateData.subworkItems[subwork.subworks_id] || [];
              const subworkTotal = items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
              const unitCount = items.reduce((sum, item) => sum + (item.ssr_quantity || 0), 0);

              return (
                <tr key={`part-a-${subwork.subworks_id}`}>
                  <td className="border border-black p-2 text-center">{index + 1}</td>
                  <td className="border border-black p-2">Solid waste management</td>
                  <td className="border border-black p-2">{subwork.subworks_name}</td>
                  <td className="border border-black p-2 text-center">{unitCount}</td>
                  <td className="border border-black p-2 text-right">{subworkTotal > 0 ? (subworkTotal / Math.max(unitCount, 1)).toFixed(2) : '0.00'}</td>
                  <td className="border border-black p-2 text-right">{subworkTotal.toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(subworkTotal * 0.7).toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(subworkTotal * 0.3).toFixed(2)}</td>
                </tr>
              );
            })}

            {recapCalculations && (
              <>
                <tr className="font-bold">
                  <td colSpan={5} className="border border-black p-2 text-right">Subtotal - Part A</td>
                  <td className="border border-black p-2 text-right">{recapCalculations.partA.subtotal.toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(recapCalculations.partA.subtotal * 0.7).toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(recapCalculations.partA.subtotal * 0.3).toFixed(2)}</td>
                </tr>

                {taxes.filter(tax => tax.applyTo === 'part_a' || tax.applyTo === 'both').map(tax => (
                  <tr key={`part-a-tax-${tax.id}`} className="font-semibold">
                    <td colSpan={5} className="border border-black p-2 text-right">
                      Add {tax.percentage}% {tax.name}
                    </td>
                    <td className="border border-black p-2 text-right">
                      {(recapCalculations.partA.taxes[tax.id] || 0).toFixed(2)}
                    </td>
                    <td className="border border-black p-2 text-right">
                      {((recapCalculations.partA.taxes[tax.id] || 0) * 0.7).toFixed(2)}
                    </td>
                    <td className="border border-black p-2 text-right">
                      {((recapCalculations.partA.taxes[tax.id] || 0) * 0.3).toFixed(2)}
                    </td>
                  </tr>
                ))}

                <tr className="font-bold">
                  <td colSpan={5} className="border border-black p-2 text-right">Total of PART - A</td>
                  <td className="border border-black p-2 text-right">{recapCalculations.partA.total.toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(recapCalculations.partA.total * 0.7).toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(recapCalculations.partA.total * 0.3).toFixed(2)}</td>
                </tr>
              </>
            )}

            <tr className="bg-gray-200 font-bold">
              <td colSpan={8} className="border border-black p-2">PART-B: Construction works for E-Tendering</td>
            </tr>
            {getPartBSubworks().map((subwork, index) => {
              const items = estimateData.subworkItems[subwork.subworks_id] || [];
              const subworkTotal = items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
              const unitCount = items.reduce((sum, item) => sum + (item.ssr_quantity || 0), 0);

              return (
                <tr key={`part-b-${subwork.subworks_id}`}>
                  <td className="border border-black p-2 text-center">{index + 1}</td>
                  <td className="border border-black p-2">Solid waste management</td>
                  <td className="border border-black p-2">{subwork.subworks_name}</td>
                  <td className="border border-black p-2 text-center">{unitCount}</td>
                  <td className="border border-black p-2 text-right">{subworkTotal > 0 ? (subworkTotal / Math.max(unitCount, 1)).toFixed(2) : '0.00'}</td>
                  <td className="border border-black p-2 text-right">{subworkTotal.toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(subworkTotal * 0.7).toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(subworkTotal * 0.3).toFixed(2)}</td>
                </tr>
              );
            })}

            {recapCalculations && (
              <>
                <tr className="font-bold">
                  <td colSpan={5} className="border border-black p-2 text-right">Subtotal - Part B</td>
                  <td className="border border-black p-2 text-right">{recapCalculations.partB.subtotal.toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(recapCalculations.partB.subtotal * 0.7).toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(recapCalculations.partB.subtotal * 0.3).toFixed(2)}</td>
                </tr>

                {taxes.filter(tax => tax.applyTo === 'part_b' || tax.applyTo === 'both').map(tax => (
                  <tr key={`part-b-tax-${tax.id}`} className="font-semibold">
                    <td colSpan={5} className="border border-black p-2 text-right">
                      Add {tax.percentage}% {tax.name}
                    </td>
                    <td className="border border-black p-2 text-right">
                      {(recapCalculations.partB.taxes[tax.id] || 0).toFixed(2)}
                    </td>
                    <td className="border border-black p-2 text-right">
                      {((recapCalculations.partB.taxes[tax.id] || 0) * 0.7).toFixed(2)}
                    </td>
                    <td className="border border-black p-2 text-right">
                      {((recapCalculations.partB.taxes[tax.id] || 0) * 0.3).toFixed(2)}
                    </td>
                  </tr>
                ))}

                <tr className="font-bold">
                  <td colSpan={5} className="border border-black p-2 text-right">Total of PART - B</td>
                  <td className="border border-black p-2 text-right">{recapCalculations.partB.total.toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(recapCalculations.partB.total * 0.7).toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(recapCalculations.partB.total * 0.3).toFixed(2)}</td>
                </tr>

                <tr className="font-bold">
                  <td colSpan={5} className="border border-black p-2 text-right">Add 0.50% Contingencies</td>
                  <td className="border border-black p-2 text-right">{recapCalculations.additionalCharges.contingencies.toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(recapCalculations.additionalCharges.contingencies * 0.7).toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(recapCalculations.additionalCharges.contingencies * 0.3).toFixed(2)}</td>
                </tr>

                <tr className="font-bold">
                  <td colSpan={5} className="border border-black p-2 text-right">Inspection charges 0.50%</td>
                  <td className="border border-black p-2 text-right">{recapCalculations.additionalCharges.inspectionCharges.toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(recapCalculations.additionalCharges.inspectionCharges * 0.7).toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">0.00</td>
                </tr>

                <tr className="font-bold">
                  <td colSpan={5} className="border border-black p-2 text-right">DPR charges 5% or 1 Lakh whichever is less</td>
                  <td className="border border-black p-2 text-right">{recapCalculations.additionalCharges.dprCharges.toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{recapCalculations.additionalCharges.dprCharges.toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">0.00</td>
                </tr>

                <tr className="font-bold bg-gray-100 text-lg">
                  <td colSpan={5} className="border border-black p-2 text-right">Gross Total Estimated Amount</td>
                  <td className="border border-black p-2 text-right">{recapCalculations.grandTotal.toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(recapCalculations.grandTotal * 0.7).toFixed(2)}</td>
                  <td className="border border-black p-2 text-right">{(recapCalculations.grandTotal * 0.3).toFixed(2)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-center mt-6 border-t border-gray-300 pt-4">
        <p className="text-sm text-gray-600">{footerSettings.line1}</p>
        <p className="text-sm text-gray-600">{footerSettings.line2}</p>
        {showPageNumbers && pageNumberPosition === 'bottom' && (
          <p className="text-xs text-gray-500 mt-2">Page {pageNumber}</p>
        )}
      </div>
    </div>
  );
};
