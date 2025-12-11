import React from 'react';
import { CompleteEstimateData } from './EstimateSupabaseOperations';

interface EstimateSubworkDetailsProps {
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
  startingPageNumber: number;
}

export const EstimateSubworkDetails: React.FC<EstimateSubworkDetailsProps> = ({
  estimateData,
  headerSettings,
  footerSettings,
  showPageNumbers,
  pageNumberPosition,
  startingPageNumber
}) => {
  const formatNumber = (num: number) => {
    return num.toLocaleString('hi-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  };

  let currentPageNumber = startingPageNumber;

  return (
    <div className="subwork-details" style={{ pageBreakInside: 'avoid' }}>
      {estimateData.subworks.map((subwork, subworkIndex) => {
        const items = estimateData.subworkItems[subwork.subworks_id] || [];
        
        return (
          <div key={subwork.subworks_id} className="page-break bg-white p-6 min-h-screen flex flex-col" style={{ pageBreakBefore: 'always', pageBreakAfter: 'always' }}>
            {/* Header Section */}
            <div className="text-center mb-6" style={{ fontSize: '14px', fontWeight: 'bold' }}>
              <h1 className="text-lg font-bold text-black mb-2">
                {headerSettings.line1}
              </h1>
              <h2 className="text-base font-bold text-black mb-4">
                NAME OF WORK: {estimateData.work.work_name}
              </h2>
              
              {/* Location Information */}
              <div className="text-sm text-black mb-4">
                <div className="flex justify-between items-center">
                  <span>Village :- {estimateData.work.village || 'N/A'},</span>
                  <span>GP :- {estimateData.work.grampanchayat || 'N/A'},</span>
                  <span>Tah :- {estimateData.work.taluka || 'N/A'}</span>
                </div>
              </div>
              
              <h3 className="text-base font-bold text-black mb-4">
                Sub-Work :- {subwork.subworks_name}
              </h3>
              
              <h2 className="text-lg font-bold text-black underline mb-6">
                MEASUREMENT
              </h2>
            </div>

            {/* Measurement Table */}
            <div className="flex-1">
              <table className="w-full border-collapse border-2 border-black text-sm" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr className="bg-white" style={{ backgroundColor: 'white' }}>
                    <th className="border border-black p-2 text-center font-bold w-2/5" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Items</th>
                    <th className="border border-black p-2 text-center font-bold w-12" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Nos.</th>
                    <th className="border border-black p-2 text-center font-bold w-16" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Length</th>
                    <th className="border border-black p-2 text-center font-bold w-16" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Breadth</th>
                    <th className="border border-black p-2 text-center font-bold w-16" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Height/Depth</th>
                    <th className="border border-black p-2 text-center font-bold w-16" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Qty.</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, itemIndex) => {
                    const measurements = estimateData.measurements[item.id] || [];
                    const hasValidMeasurements = measurements.length > 0;
                    
                    return (
                      <React.Fragment key={item.id}>
                        {/* Item Header Row */}
                        <tr>
                          <td className="border border-black p-2 font-bold" style={{ border: '1px solid black', padding: '8px', fontWeight: 'bold' }}>
                            Item No.{itemIndex + 1} :
                          </td>
                          <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                          <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                          <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                          <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                          <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                        </tr>
                        
                        {/* Item Description Row */}
                        <tr>
                          <td className="border border-black p-2 text-justify leading-tight" style={{ border: '1px solid black', padding: '8px', textAlign: 'justify', lineHeight: '1.2' }}>
                            {item.description_of_item}
                          </td>
                          <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                          <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                          <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                          <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                          <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                        </tr>

                        {/* Measurement Rows */}
                        {hasValidMeasurements ? (
                          measurements.map((measurement, measurementIndex) => (
                            <tr key={measurementIndex}>
                              <td className="border border-black p-2 text-right pr-4">
                                {measurement.description_of_items || ''}
                              </td>
                              <td className="border border-black p-2 text-center">
                                {measurement.no_of_units || 1}
                              </td>
                              <td className="border border-black p-2 text-center">
                                {formatNumber(measurement.length || 0)}
                              </td>
                              <td className="border border-black p-2 text-center">
                                {formatNumber(measurement.width_breadth || 0)}
                              </td>
                              <td className="border border-black p-2 text-center">
                                {formatNumber(measurement.height_depth || 0)}
                              </td>
                              <td className="border border-black p-2 text-center">
                                {formatNumber(measurement.calculated_quantity || 0)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          // Empty measurement rows for manual entry
                          <>
                            <tr>
                              <td className="border border-black p-2 h-8"></td>
                              <td className="border border-black p-2"></td>
                              <td className="border border-black p-2"></td>
                              <td className="border border-black p-2"></td>
                              <td className="border border-black p-2"></td>
                              <td className="border border-black p-2"></td>
                            </tr>
                            <tr>
                              <td className="border border-black p-2 h-8"></td>
                              <td className="border border-black p-2"></td>
                              <td className="border border-black p-2"></td>
                              <td className="border border-black p-2"></td>
                              <td className="border border-black p-2"></td>
                              <td className="border border-black p-2"></td>
                            </tr>
                          </>
                        )}

                        {/* Total Row for Item */}
                        <tr>
                          <td className="border border-black p-2 text-right font-bold pr-4">
                            Total
                          </td>
                          <td className="border border-black p-2"></td>
                          <td className="border border-black p-2"></td>
                          <td className="border border-black p-2"></td>
                          <td className="border border-black p-2"></td>
                          <td className="border border-black p-2 text-center font-bold">
                            {hasValidMeasurements 
                              ? formatNumber(measurements.reduce((sum, m) => sum + (m.calculated_quantity || 0), 0))
                              : ''
                            }
                          </td>
                        </tr>

                        {/* Spacing row between items */}
                        {itemIndex < items.length - 1 && (
                          <tr>
                            <td className="border border-black p-1" colSpan={6}></td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Add some empty rows for manual entries */}
                  {Array.from({ length: 5 }, (_, index) => (
                    <tr key={`empty-${index}`}>
                      <td className="border border-black p-2 h-8"></td>
                      <td className="border border-black p-2"></td>
                      <td className="border border-black p-2"></td>
                      <td className="border border-black p-2"></td>
                      <td className="border border-black p-2"></td>
                      <td className="border border-black p-2"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="text-center mt-6 pt-4">
              <p className="text-xs text-gray-600">{footerSettings.line1}</p>
              <p className="text-xs text-gray-600">{footerSettings.line2}</p>
              {showPageNumbers && pageNumberPosition === 'bottom' && (
                <p className="text-xs text-gray-500 mt-2">Page {currentPageNumber++}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
