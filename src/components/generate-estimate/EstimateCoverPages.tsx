import React from 'react';
import { Work } from '../../types';
import { CompleteEstimateData } from './EstimateSupabaseOperations';

interface EstimateCoverPagesProps {
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
}

export const EstimateCoverPages: React.FC<EstimateCoverPagesProps> = ({
  estimateData,
  headerSettings,
  footerSettings,
  showPageNumbers,
  pageNumberPosition
}) => {
  const { work } = estimateData;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const calculateTotalEstimate = () => {
    const costValue = work.total_estimated_cost;
    console.log('🔍 EstimateCoverPages - Total Estimated Cost:', costValue, typeof costValue);
    console.log('🔍 EstimateCoverPages - Work Object:', work);
    if (typeof costValue === 'string') {
      const parsed = parseFloat(costValue) || 0;
      console.log('✅ Parsed as string:', parsed);
      return parsed;
    }
    const converted = Number(costValue) || 0;
    console.log('✅ Converted as number:', converted);
    return converted;
  };

  return (
    <div className="estimate-cover-pages">
      {/* First Page - Title Page */}
      <div className="page-break bg-white p-8 min-h-screen flex flex-col">
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-gray-300 pb-4">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            {headerSettings.line1}
          </h1>
          <h2 className="text-lg font-semibold text-blue-600 mb-1">
            {headerSettings.line2}
          </h2>
          <h3 className="text-base text-blue-500">
            {headerSettings.line3}
          </h3>
        </div>

        {/* Main Title */}
        <div className="flex-1 flex flex-col justify-center items-center text-center">
          <div className="border-4 border-double border-gray-400 p-8 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">
              DETAILED ESTIMATE
            </h1>
            
            <div className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold">Work ID:</span>
                  <span className="ml-2">{work.works_id}</span>
                </div>
                <div>
                  <span className="font-semibold">Type:</span>
                  <span className="ml-2">{work.type}</span>
                </div>
              </div>
              
              {/* Location Information */}
              {(work.taluka || work.district) && (
                <div className="text-center text-sm text-gray-700">
                  {work.taluka && work.district && (
                    <span>Tah: {work.taluka}, Dist:- {work.district}</span>
                  )}
                </div>
              )}
              
              <div className="border-t pt-4">
                <h2 className="text-xl font-bold mb-4 text-center">
                  {work.work_name}
                </h2>
              </div>
              
              <div className="grid grid-cols-1 gap-2 text-sm">
                {work.village && (
                  <div>
                    <span className="font-semibold">Village:</span>
                    <span className="ml-2">{work.village}</span>
                  </div>
                )}
                {work.grampanchayat && (
                  <div>
                    <span className="font-semibold">Gram Panchayat:</span>
                    <span className="ml-2">{work.grampanchayat}</span>
                  </div>
                )}
                {work.division && (
                  <div>
                    <span className="font-semibold">Division:</span>
                    <span className="ml-2">{work.division}</span>
                  </div>
                )}
                {work.sub_division && (
                  <div>
                    <span className="font-semibold">Sub Division:</span>
                    <span className="ml-2">{work.sub_division}</span>
                  </div>
                )}
                {work.ssr && (
                  <div>
                    <span className="font-semibold">SSR:</span>
                    <span className="ml-2">{work.ssr}</span>
                  </div>
                )}
              </div>
              
              <div className="border-t pt-4 text-center">
                <div className="text-lg font-bold">
                  Total Estimated Cost: {formatCurrency(calculateTotalEstimate())}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 border-t-2 border-gray-300 pt-4">
          <p className="text-sm text-gray-600">{footerSettings.line1}</p>
          <p className="text-sm text-gray-600">{footerSettings.line2}</p>
          {showPageNumbers && pageNumberPosition === 'bottom' && (
            <p className="text-xs text-gray-500 mt-2">Page 1</p>
          )}
        </div>
      </div>

      {/* Second Page - Work Details */}
      <div className="page-break bg-white p-8 pr-16 min-h-screen flex flex-col" style={{ marginLeft: '20mm', marginRight: '20mm' }}>
        {/* Header */}
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

        {/* Work Information */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
            WORK INFORMATION
          </h2>
          
          <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
            <table className="min-w-full">
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50 w-1/3">
                    Work ID
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {work.works_id}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                    Work Name
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {work.work_name}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                    Type
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {work.type}
                  </td>
                </tr>
                {work.division && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                      Division
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {work.division}
                    </td>
                  </tr>
                )}
                {work.village && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                      Village
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {work.village}
                    </td>
                  </tr>
                )}
                {work.grampanchayat && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                      Gram Panchayat
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {work.grampanchayat}
                    </td>
                  </tr>
                )}
                {work.taluka && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                      Taluka
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {work.taluka}
                    </td>
                  </tr>
                )}
                {work.district && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                      District
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {work.district}
                    </td>
                  </tr>
                )}
                {work.sub_division && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                      Sub Division
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {work.sub_division}
                    </td>
                  </tr>
                )}
                {work.ssr && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                      SSR
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {work.ssr}
                    </td>
                  </tr>
                )}
                {work.fund_head && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                      Fund Head
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {work.fund_head}
                    </td>
                  </tr>
                )}
                {work.major_head && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                      Major Head
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {work.major_head}
                    </td>
                  </tr>
                )}
                {work.minor_head && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                      Minor Head
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {work.minor_head}
                    </td>
                  </tr>
                )}
                {work.service_head && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                      Service Head
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {work.service_head}
                    </td>
                  </tr>
                )}
                {work.departmental_head && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                      Departmental Head
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {work.departmental_head}
                    </td>
                  </tr>
                )}
                {work.sanctioning_authority && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                      Sanctioning Authority
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {work.sanctioning_authority}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                    Status
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 capitalize">
                    {work.status}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
                    Created Date
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(work.created_at).toLocaleDateString('hi-IN')}
                  </td>
                </tr>
                <tr className="bg-yellow-50">
                  <td className="px-4 py-3 text-sm font-bold text-gray-700 bg-yellow-100">
                    Total Estimated Cost
                  </td>
                  <td className="px-4 py-3 text-lg font-bold text-green-600">
                    {formatCurrency(calculateTotalEstimate())}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary Statistics */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {estimateData.subworks.length}
              </div>
              <div className="text-sm text-blue-800">Total Subworks</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(estimateData.subworkItems).flat().length}
              </div>
              <div className="text-sm text-green-800">Total Items</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Object.values(estimateData.measurements).flat().length}
              </div>
              <div className="text-sm text-purple-800">Total Measurements</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 border-t border-gray-300 pt-4">
          <p className="text-sm text-gray-600">{footerSettings.line1}</p>
          <p className="text-sm text-gray-600">{footerSettings.line2}</p>
          {showPageNumbers && pageNumberPosition === 'bottom' && (
            <p className="text-xs text-gray-500 mt-2">Page 2</p>
          )}
        </div>
      </div>
    </div>
  );
};
