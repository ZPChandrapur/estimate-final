import React from 'react';

interface EstimateQuarryChartProps {
  workName: string;
  village: string;
  grampanchayat: string;
  taluka: string;
  worksId: string;
  PageHeader: React.FC<{ pageNumber: number }>;
  PageFooter: React.FC<{ pageNumber: number }>;
  startPageNumber: number;
}

export const EstimateQuarryChart: React.FC<EstimateQuarryChartProps> = ({
  workName,
  village,
  grampanchayat,
  taluka,
  PageHeader,
  PageFooter,
  startPageNumber
}) => {
  return (
    <div className="pdf-page bg-white p-6 min-h-[297mm] flex flex-col" style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}>
      <PageHeader pageNumber={startPageNumber} />
      <div className="flex-1">
        <div className="text-center mb-6">
          <h3 className="text-lg font-bold mb-2">QUARRY CHART / ROUTE DIAGRAM</h3>
          <h4 className="text-base font-semibold">Name of Work :- {workName}</h4>
          <p className="text-sm">at {village || 'N/A'}, G.P. {grampanchayat || 'N/A'}, Ta.: {taluka || 'N/A'}</p>
        </div>

        <div className="border-2 border-gray-800 min-h-[200mm] bg-gray-50 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-sm mb-2">Quarry Chart Placeholder</p>
            <p className="text-xs">Please use the Quarry Chart tool in the Works page to create and export the diagram.</p>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-600">
          <p className="font-semibold mb-2">Instructions:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Shows route from work site to quarry/material source</li>
            <li>Indicates villages, roads, and distances along the route</li>
            <li>Marks quarry locations and depot positions</li>
            <li>Use the interactive Quarry Chart tool to create detailed diagrams</li>
          </ol>
        </div>
      </div>
      <PageFooter pageNumber={startPageNumber} />
    </div>
  );
};
