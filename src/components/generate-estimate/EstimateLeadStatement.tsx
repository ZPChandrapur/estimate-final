import React from 'react';

interface LeadStatementItem {
  id: string;
  works_id: string;
  sr_no: number;
  material: string;
  material_type?: string;
  reference: string;
  lead_in_km: number;
  lead_charges: number;
  total_rate: number;
  unit: string;
  unit_from_lead_chart?: string;
}

interface EstimateLeadStatementProps {
  workName: string;
  village: string;
  grampanchayat: string;
  taluka: string;
  leadStatements: LeadStatementItem[];
  PageHeader: React.FC<{ pageNumber: number }>;
  PageFooter: React.FC<{ pageNumber: number }>;
  startPageNumber: number;
}

export const EstimateLeadStatement: React.FC<EstimateLeadStatementProps> = ({
  workName,
  village,
  grampanchayat,
  taluka,
  leadStatements,
  PageHeader,
  PageFooter,
  startPageNumber
}) => {
  if (!leadStatements || leadStatements.length === 0) {
    return null;
  }

  const pages: React.ReactNode[] = [];
  let currentPageNumber = startPageNumber;
  let currentPageItems: LeadStatementItem[] = [];
  const ITEMS_PER_PAGE = 20;

  leadStatements.forEach((item, index) => {
    currentPageItems.push(item);

    if (currentPageItems.length === ITEMS_PER_PAGE || index === leadStatements.length - 1) {
      pages.push(
        <div key={`lead-statement-page-${currentPageNumber}`} className="pdf-page bg-white p-6 min-h-[297mm] flex flex-col" style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}>
          <PageHeader pageNumber={currentPageNumber} />
          <div className="flex-1">
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold mb-2">LEAD STATEMENT</h3>
              <h4 className="text-base font-semibold">Name of Work :- {workName}</h4>
              <p className="text-sm">at {village || 'N/A'}, G.P. {grampanchayat || 'N/A'}, Ta.: {taluka || 'N/A'}</p>
            </div>

            <table className="w-full border-collapse border border-black text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black p-2 text-center" style={{ width: '8%' }}>Sr.No.</th>
                  <th className="border border-black p-2 text-left" style={{ width: '25%' }}>Material</th>
                  <th className="border border-black p-2 text-left" style={{ width: '15%' }}>Material Type</th>
                  <th className="border border-black p-2 text-left" style={{ width: '15%' }}>Reference</th>
                  <th className="border border-black p-2 text-center" style={{ width: '12%' }}>Lead (km)</th>
                  <th className="border border-black p-2 text-center" style={{ width: '12%' }}>Lead Charges</th>
                  <th className="border border-black p-2 text-center" style={{ width: '8%' }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {currentPageItems.map((item) => {
                  const leadKm = Number(item.lead_in_km) || 0;
                  const leadCharges = Number(item.lead_charges) || 0;

                  return (
                    <tr key={item.id}>
                      <td className="border border-black p-2 text-center">{item.sr_no}</td>
                      <td className="border border-black p-2">{item.material || '-'}</td>
                      <td className="border border-black p-2">{item.material_type || '-'}</td>
                      <td className="border border-black p-2">{item.reference || '-'}</td>
                      <td className="border border-black p-2 text-center">
                        {leadKm > 0 ? leadKm.toFixed(2) : '-'}
                      </td>
                      <td className="border border-black p-2 text-right">
                        {leadCharges > 0 ? leadCharges.toFixed(2) : '-'}
                      </td>
                      <td className="border border-black p-2 text-center">{item.unit || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PageFooter pageNumber={currentPageNumber} />
        </div>
      );

      currentPageNumber++;
      currentPageItems = [];
    }
  });

  return <>{pages}</>;
};
