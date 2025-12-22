import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Search,
  Filter,
  Download,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { createBOQTemplateData, numberToWords, BOQTemplateRow } from '../../lib/boqUtils';

interface BOQManagementProps {
  onNavigate: (page: string) => void;
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  status: string;
}

interface BOQItem {
  id?: string;
  project_id: string;
  subwork_id?: string;
  subwork_name?: string;
  item_number: string;
  description: string;
  unit: string;
  boq_quantity: number;
  rate: number;
  amount: number;
  amount_with_taxes?: number;
  amount_in_words?: string;
  executed_quantity: number;
  balance_quantity: number;
  remarks?: string;
}

const BOQManagement: React.FC<BOQManagementProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [previewItems, setPreviewItems] = useState<BOQItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchBOQItems(selectedProject);
    }
  }, [selectedProject]);

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
      setError('Failed to fetch projects');
    }
  };

  const fetchBOQItems = async (projectId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('mb_boq_items')
        .select(`
          *,
          mb_work_subworks!subwork_id(
            subwork_name
          )
        `)
        .eq('project_id', projectId)
        .order('item_number');

      if (error) throw error;

      const itemsWithSubwork = (data || []).map((item: any) => ({
        ...item,
        subwork_name: item.mb_work_subworks?.subwork_name || ''
      }));

      setBoqItems(itemsWithSubwork);
    } catch (error) {
      console.error('Error fetching BOQ items:', error);
      setError('Failed to fetch BOQ items');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedProject) {
      setError('Please select a project first');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet) as any[];

          const items: BOQItem[] = json.map((row) => {
            const slNo = String(row['Sl. No.'] || row['Sl.No.'] || row['SlNo'] || '');
            const description = String(row['Item Description'] || row['Description'] || row['description'] || '');
            const quantity = Number(row['Quantity'] || row['boq_quantity'] || 0);
            const rate = Number(row['Estimated Rate'] || row['Rate'] || row['rate'] || 0);
            const amountWithoutTaxes = Number(row['TOTAL AMOUNT Without Taxes'] || 0) || (quantity * rate);
            const amountWithTaxes = Number(row['TOTAL AMOUNT With Taxes'] || 0) || amountWithoutTaxes;
            const amountInWords = String(row['TOTAL AMOUNT In Words'] || '') || numberToWords(Math.round(amountWithTaxes));

            return {
              project_id: selectedProject,
              item_number: slNo,
              description: description,
              unit: String(row['Units'] || row['Unit'] || row['unit'] || ''),
              boq_quantity: quantity,
              rate: rate,
              amount: amountWithoutTaxes,
              amount_with_taxes: amountWithTaxes,
              amount_in_words: amountInWords,
              executed_quantity: 0,
              balance_quantity: quantity,
              remarks: amountInWords
            };
          });

          const errors = validateBOQItems(items);
          if (errors.length > 0) {
            setError(`Validation errors: ${errors.join(', ')}`);
            setLoading(false);
            return;
          }

          setPreviewItems(items);
          setShowPreview(true);
        } catch (parseError) {
          console.error('Error parsing file:', parseError);
          setError('Failed to parse file. Please ensure it matches the template format.');
        } finally {
          setLoading(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Failed to upload file');
      setLoading(false);
    }
  };

  const validateBOQItems = (items: BOQItem[]): string[] => {
    const errors: string[] = [];

    items.forEach((item, index) => {
      if (!item.item_number) errors.push(`Row ${index + 1}: Missing Sl. No.`);
      if (!item.description) errors.push(`Row ${index + 1}: Missing Item Description`);
      if (!item.unit) errors.push(`Row ${index + 1}: Missing Units`);
      if (item.boq_quantity <= 0) errors.push(`Row ${index + 1}: Invalid Quantity`);
      if (item.rate <= 0) errors.push(`Row ${index + 1}: Invalid Estimated Rate`);
    });

    return errors;
  };

  const confirmUpload = async () => {
    try {
      setUploading(true);
      setError('');

      const { error } = await supabase
        .schema('estimate')
        .from('mb_boq_items')
        .insert(previewItems);

      if (error) throw error;

      setSuccess('BOQ items uploaded successfully');
      setShowPreview(false);
      setPreviewItems([]);
      fetchBOQItems(selectedProject);
    } catch (error) {
      console.error('Error saving BOQ items:', error);
      setError('Failed to save BOQ items');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = createBOQTemplateData();

    const ws = XLSX.utils.json_to_sheet(templateData);

    const colWidths = [
      { wch: 8 },
      { wch: 80 },
      { wch: 12 },
      { wch: 10 },
      { wch: 15 },
      { wch: 25 },
      { wch: 22 },
      { wch: 50 }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOQ Template');
    XLSX.writeFile(wb, 'BOQ_Template.xlsx');
  };

  const exportToExcel = () => {
    const exportData: BOQTemplateRow[] = boqItems.map((item, index) => {
      const descriptionWithSubwork = item.subwork_name
        ? `${item.subwork_name}\n${item.description}`
        : item.description;

      const amountWithTaxes = item.amount_with_taxes || item.amount;
      const amountInWords = item.amount_in_words || numberToWords(Math.round(amountWithTaxes));

      return {
        'Sl. No.': String(index + 1),
        'Item Description': descriptionWithSubwork,
        'Quantity': item.boq_quantity,
        'Units': item.unit,
        'Estimated Rate': item.rate,
        'TOTAL AMOUNT Without Taxes': item.amount,
        'TOTAL AMOUNT With Taxes': amountWithTaxes,
        'TOTAL AMOUNT In Words': amountInWords
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);

    const colWidths = [
      { wch: 8 },
      { wch: 80 },
      { wch: 12 },
      { wch: 10 },
      { wch: 15 },
      { wch: 25 },
      { wch: 22 },
      { wch: 50 }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOQ');
    XLSX.writeFile(wb, `BOQ_${selectedProject}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredItems = boqItems.filter(item =>
    item.item_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => onNavigate('dashboard')}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">BOQ Management</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <button onClick={() => setError('')} className="text-red-600 hover:text-red-800">
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <p className="text-sm text-green-700 mt-1">{success}</p>
            </div>
            <button onClick={() => setSuccess('')} className="text-green-600 hover:text-green-800">
              ×
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Project</h2>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a project...</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.project_code} - {project.project_name}
              </option>
            ))}
          </select>
        </div>

        {selectedProject && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload BOQ</h2>

            <div className="flex items-center space-x-4 mb-4">
              <label className="flex-1">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="boq-upload"
                />
                <label
                  htmlFor="boq-upload"
                  className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 transition-colors"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Excel File
                </label>
              </label>
              <button
                onClick={downloadTemplate}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <FileSpreadsheet className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">BOQ Template Format</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    Download the template to see the required format. The template includes columns: Sl. No., Item Description (with subwork name at the beginning for each subwork section), Quantity, Units, Estimated Rate, TOTAL AMOUNT Without Taxes, TOTAL AMOUNT With Taxes, and TOTAL AMOUNT In Words.
                  </p>
                  <div className="text-sm text-blue-700 mb-2">
                    <strong>Item Description format:</strong>
                  </div>
                  <div className="bg-white p-3 rounded border border-blue-300 text-xs font-mono text-blue-900 space-y-1">
                    <div>SUB WORK NO. 1 :- SUBWORK NAME</div>
                    <div>Item No.1: Detailed item description...</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPreview && previewItems.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview ({previewItems.length} items)</h3>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sl. No.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewItems.slice(0, 10).map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.item_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-pre-wrap max-w-md">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.boq_quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.unit}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">₹{item.rate.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">₹{item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewItems.length > 10 && (
                <p className="text-sm text-gray-500 text-center mt-2">
                  Showing 10 of {previewItems.length} items
                </p>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowPreview(false);
                  setPreviewItems([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpload}
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Confirm Upload'}
              </button>
            </div>
          </div>
        )}

        {selectedProject && boqItems.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">BOQ Items ({filteredItems.length})</h3>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={exportToExcel}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sl. No.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Executed</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.map((item) => {
                    const displayDescription = item.subwork_name
                      ? `${item.subwork_name}\n${item.description}`
                      : item.description;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{item.item_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-pre-wrap max-w-2xl">{displayDescription}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.boq_quantity.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.unit}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">₹{item.rate.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">₹{item.amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">{item.executed_quantity.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right text-orange-600">{item.balance_quantity.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading BOQ items...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BOQManagement;
