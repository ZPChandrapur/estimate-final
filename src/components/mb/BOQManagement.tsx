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
  item_number: string;
  description: string;
  unit: string;
  boq_quantity: number;
  rate: number;
  amount: number;
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
        .select('*')
        .eq('project_id', projectId)
        .order('item_number');

      if (error) throw error;
      setBoqItems(data || []);
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

    setError('');
    setSuccess('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];

        const items: BOQItem[] = json.map((row) => ({
          project_id: selectedProject,
          item_number: String(row['Item Number'] || row['item_number'] || ''),
          description: String(row['Description'] || row['description'] || ''),
          unit: String(row['Unit'] || row['unit'] || ''),
          boq_quantity: Number(row['Quantity'] || row['boq_quantity'] || 0),
          rate: Number(row['Rate'] || row['rate'] || 0),
          amount: 0,
          executed_quantity: 0,
          balance_quantity: 0,
          remarks: String(row['Remarks'] || row['remarks'] || '')
        }));

        const errors = validateBOQItems(items);
        if (errors.length > 0) {
          setError(`Validation errors: ${errors.join(', ')}`);
          return;
        }

        setPreviewItems(items);
        setShowPreview(true);
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      console.error('Error parsing file:', error);
      setError('Failed to parse file. Please ensure it is a valid Excel file.');
    }
  };

  const validateBOQItems = (items: BOQItem[]): string[] => {
    const errors: string[] = [];

    items.forEach((item, index) => {
      if (!item.item_number) errors.push(`Row ${index + 1}: Item number is required`);
      if (!item.description) errors.push(`Row ${index + 1}: Description is required`);
      if (!item.unit) errors.push(`Row ${index + 1}: Unit is required`);
      if (item.boq_quantity <= 0) errors.push(`Row ${index + 1}: Quantity must be greater than 0`);
      if (item.rate <= 0) errors.push(`Row ${index + 1}: Rate must be greater than 0`);
    });

    const itemNumbers = items.map(i => i.item_number);
    const duplicates = itemNumbers.filter((num, idx) => itemNumbers.indexOf(num) !== idx);
    if (duplicates.length > 0) {
      errors.push(`Duplicate item numbers found: ${[...new Set(duplicates)].join(', ')}`);
    }

    return errors;
  };

  const confirmUpload = async () => {
    if (!user || !selectedProject) return;

    try {
      setUploading(true);
      setError('');

      const itemsToInsert = previewItems.map(item => ({
        ...item,
        created_by: user.id
      }));

      const { error: insertError } = await supabase
        .schema('estimate')
        .from('mb_boq_items')
        .insert(itemsToInsert);

      if (insertError) throw insertError;

      await supabase
        .schema('estimate')
        .from('mb_audit_logs')
        .insert({
          project_id: selectedProject,
          user_id: user.id,
          action: 'boq_uploaded',
          entity_type: 'boq',
          details: { item_count: previewItems.length }
        });

      setSuccess(`Successfully uploaded ${previewItems.length} BOQ items`);
      setShowPreview(false);
      setPreviewItems([]);
      fetchBOQItems(selectedProject);
    } catch (error) {
      console.error('Error uploading BOQ:', error);
      setError('Failed to upload BOQ items');
    } finally {
      setUploading(false);
    }
  };

  const exportToExcel = () => {
    const exportData = boqItems.map(item => ({
      'Item Number': item.item_number,
      'Description': item.description,
      'Unit': item.unit,
      'BOQ Quantity': item.boq_quantity,
      'Rate': item.rate,
      'Amount': item.amount,
      'Executed Quantity': item.executed_quantity,
      'Balance Quantity': item.balance_quantity,
      'Remarks': item.remarks || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">BOQ Management</h1>
          <p className="text-gray-600 mt-2">Upload, view, and manage Bill of Quantities</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <p className="text-sm text-green-700 mt-1">{success}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Project
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload BOQ File
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={!selectedProject}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {showPreview && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview BOQ Items ({previewItems.length} items)</h3>
            <div className="max-h-96 overflow-y-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewItems.slice(0, 10).map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.item_number}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.description}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.unit}</td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900">{item.boq_quantity}</td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900">₹{item.rate.toFixed(2)}</td>
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
            <div className="flex justify-end space-x-3">
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">BOQ Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Executed</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{item.item_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.unit}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{item.boq_quantity.toFixed(3)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">₹{item.rate.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">₹{item.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">{item.executed_quantity.toFixed(3)}</td>
                      <td className="px-4 py-3 text-sm text-right text-orange-600">{item.balance_quantity.toFixed(3)}</td>
                    </tr>
                  ))}
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
