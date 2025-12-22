import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, FileText, Download, Calendar, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';

interface MBReportsProps {
  onNavigate: (page: string) => void;
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
}

const MBReports: React.FC<MBReportsProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [reportType, setReportType] = useState<string>('mb_summary');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('mb_projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const generateReport = async () => {
    if (!selectedProject || !user) return;

    setLoading(true);

    try {
      const project = projects.find(p => p.id === selectedProject);
      if (!project) return;

      let reportData: any[] = [];
      let filename = '';

      switch (reportType) {
        case 'mb_summary':
          reportData = await generateMBSummary();
          filename = `MB_Summary_${project.project_code}_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        case 'boq_progress':
          reportData = await generateBOQProgress();
          filename = `BOQ_Progress_${project.project_code}_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        case 'financial_summary':
          reportData = await generateFinancialSummary();
          filename = `Financial_Summary_${project.project_code}_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
      }

      if (reportData.length > 0) {
        const ws = XLSX.utils.json_to_sheet(reportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        XLSX.writeFile(wb, filename);

        await supabase
          .schema('estimate')
          .from('mb_reports')
          .insert({
            project_id: selectedProject,
            report_type: reportType,
            report_name: filename,
            generated_by: user.id,
            parameters: { project_code: project.project_code }
          });

        await supabase
          .schema('estimate')
          .from('mb_audit_logs')
          .insert({
            project_id: selectedProject,
            user_id: user.id,
            action: 'report_generated',
            entity_type: 'report',
            details: { report_type: reportType, filename }
          });
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMBSummary = async () => {
    const { data: measurements } = await supabase
      .schema('estimate')
      .from('mb_measurements')
      .select(`
        *,
        boq_item:mb_boq_items(item_number, description, unit)
      `)
      .eq('project_id', selectedProject)
      .order('measurement_date', { ascending: true });

    return (measurements || []).map((m: any) => ({
      'Measurement Number': m.measurement_number,
      'Date': new Date(m.measurement_date).toLocaleDateString(),
      'BOQ Item': m.boq_item?.item_number,
      'Description': m.boq_item?.description,
      'Quantity': m.quantity,
      'Unit': m.boq_item?.unit,
      'Rate': m.rate,
      'Amount': m.amount,
      'Status': m.status,
      'Remarks': m.remarks || ''
    }));
  };

  const generateBOQProgress = async () => {
    const { data: boqItems } = await supabase
      .schema('estimate')
      .from('mb_boq_items')
      .select('*')
      .eq('project_id', selectedProject)
      .order('item_number');

    return (boqItems || []).map((item: any) => ({
      'Item Number': item.item_number,
      'Description': item.description,
      'Unit': item.unit,
      'BOQ Quantity': item.boq_quantity,
      'Rate': item.rate,
      'BOQ Amount': item.amount,
      'Executed Quantity': item.executed_quantity,
      'Executed Amount': item.executed_amount,
      'Balance Quantity': item.balance_quantity,
      'Balance Amount': item.amount - item.executed_amount,
      'Progress %': ((item.executed_quantity / item.boq_quantity) * 100).toFixed(2)
    }));
  };

  const generateFinancialSummary = async () => {
    const { data: boqItems } = await supabase
      .schema('estimate')
      .from('mb_boq_items')
      .select('*')
      .eq('project_id', selectedProject);

    const totalBOQAmount = boqItems?.reduce((sum: number, item: any) => sum + parseFloat(item.amount || 0), 0) || 0;
    const totalExecutedAmount = boqItems?.reduce((sum: number, item: any) => sum + parseFloat(item.executed_amount || 0), 0) || 0;

    return [{
      'Particulars': 'Total BOQ Amount',
      'Amount': totalBOQAmount.toFixed(2)
    }, {
      'Particulars': 'Total Executed Amount',
      'Amount': totalExecutedAmount.toFixed(2)
    }, {
      'Particulars': 'Balance Amount',
      'Amount': (totalBOQAmount - totalExecutedAmount).toFixed(2)
    }, {
      'Particulars': 'Progress Percentage',
      'Amount': totalBOQAmount > 0 ? ((totalExecutedAmount / totalBOQAmount) * 100).toFixed(2) + '%' : '0%'
    }];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-2">Generate and download MB reports</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Project *
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select a Project --</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_code} - {project.project_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Report Type *
              </label>
              <div className="space-y-3">
                <label className="flex items-start p-4 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="reportType"
                    value="mb_summary"
                    checked={reportType === 'mb_summary'}
                    onChange={(e) => setReportType(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-blue-600 mr-2" />
                      <span className="font-medium text-gray-900">MB Summary Report</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Detailed list of all measurements with dates, quantities, and status
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-4 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="reportType"
                    value="boq_progress"
                    checked={reportType === 'boq_progress'}
                    onChange={(e) => setReportType(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center">
                      <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
                      <span className="font-medium text-gray-900">BOQ Progress Report</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Progress tracking with executed vs BOQ quantities for each item
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-4 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="reportType"
                    value="financial_summary"
                    checked={reportType === 'financial_summary'}
                    onChange={(e) => setReportType(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center">
                      <Calendar className="w-5 h-5 text-purple-600 mr-2" />
                      <span className="font-medium text-gray-900">Financial Summary</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Overview of BOQ amounts, executed amounts, and balance
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-6 border-t">
              <button
                onClick={generateReport}
                disabled={!selectedProject || loading}
                className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Generating Report...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Generate and Download Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Report Information</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>Reports are generated in Excel format for easy analysis</li>
            <li>All report generation activities are logged in the audit trail</li>
            <li>Generated reports can be shared with stakeholders as needed</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MBReports;
