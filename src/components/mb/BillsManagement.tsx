import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { FileText, Plus, Eye, Download, ArrowLeft } from 'lucide-react';

interface BillsManagementProps {
  onNavigate: (page: string) => void;
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
}

interface Bill {
  id: string;
  bill_number: string;
  bill_date: string;
  bill_type: string;
  status: string;
  total_amount: number;
  current_bill_amount: number;
}

interface BillItem {
  id: string;
  boq_item_id: string;
  total_qty_till_now: number;
  prev_qty_upto_previous_bill: number;
  qty_now_to_be_paid: number;
  rate: number;
  bill_rate: number;
  amount: number;
  is_clause_38: boolean;
  boq_item: {
    item_number: string;
    description: string;
    unit: string;
  };
}

const BillsManagement: React.FC<BillsManagementProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<string>('');
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'create' | 'abstract'>('list');

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchBills();
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedBill) {
      fetchBillItems();
    }
  }, [selectedBill]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('mb_projects')
        .select('id, project_code, project_name')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('mb_bills')
        .select('*')
        .eq('project_id', selectedProject)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBillItems = async () => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('mb_bill_items')
        .select(`
          *,
          boq_item:boq_item_id (
            item_number,
            description,
            unit
          )
        `)
        .eq('bill_id', selectedBill)
        .order('boq_item_id');

      if (error) throw error;
      setBillItems(data || []);
    } catch (error) {
      console.error('Error fetching bill items:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderAbstract = () => {
    const regularItems = billItems.filter(item => !item.is_clause_38);
    const clause38Items = billItems.filter(item => item.is_clause_38);

    const selectedBillData = bills.find(b => b.id === selectedBill);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              setView('list');
              setSelectedBill('');
            }}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Bills
          </button>
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </button>
        </div>

        {regularItems.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
            <div className="bg-blue-50 px-6 py-3 border-b border-gray-300">
              <h3 className="text-lg font-semibold text-gray-900 text-center">
                Abstract Of RA Bill
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 border-r border-gray-300">
                      Item No.
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 border-r border-gray-300">
                      Description
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 border-r border-gray-300">
                      Total Qty Till Now
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 border-r border-gray-300">
                      Prev Qty Up to Previous Bill
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 border-r border-gray-300">
                      Qty Now to be Paid
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 border-r border-gray-300">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 border-r border-gray-300">
                      Bill Rate
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {regularItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                        {item.boq_item.item_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                        {item.boq_item.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                        {item.total_qty_till_now.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                        {item.prev_qty_upto_previous_bill.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                        {item.qty_now_to_be_paid.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                        {item.rate.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                        {item.bill_rate.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        ₹{item.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={2} className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-300">
                      Total:
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-300">
                      {regularItems.reduce((sum, item) => sum + item.total_qty_till_now, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-300">
                      {regularItems.reduce((sum, item) => sum + item.prev_qty_upto_previous_bill, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-300">
                      {regularItems.reduce((sum, item) => sum + item.qty_now_to_be_paid, 0).toFixed(2)}
                    </td>
                    <td colSpan={2} className="px-4 py-3 border-r border-gray-300"></td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      ₹{regularItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {clause38Items.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
            <div className="bg-blue-50 px-6 py-3 border-b border-gray-300">
              <h3 className="text-lg font-semibold text-gray-900 text-center">
                Abstract Of RA Bill for Clause 38 Items
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 border-r border-gray-300">
                      Item No.
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 border-r border-gray-300">
                      Description
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 border-r border-gray-300">
                      Total Qty Till Now
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 border-r border-gray-300">
                      Prev Qty Up to Previous Bill
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 border-r border-gray-300">
                      Qty Now to be Paid
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 border-r border-gray-300">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 border-r border-gray-300">
                      Bill Rate
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clause38Items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                        {item.boq_item.item_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                        {item.boq_item.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                        {item.total_qty_till_now.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                        {item.prev_qty_upto_previous_bill.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                        {item.qty_now_to_be_paid.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                        {item.rate.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-200">
                        {item.bill_rate.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        ₹{item.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={2} className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-300">
                      Total:
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-300">
                      {clause38Items.reduce((sum, item) => sum + item.total_qty_till_now, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-300">
                      {clause38Items.reduce((sum, item) => sum + item.prev_qty_upto_previous_bill, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 border-r border-gray-300">
                      {clause38Items.reduce((sum, item) => sum + item.qty_now_to_be_paid, 0).toFixed(2)}
                    </td>
                    <td colSpan={2} className="px-4 py-3 border-r border-gray-300"></td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      ₹{clause38Items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBillsList = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Project
          </label>
          <select
            value={selectedProject}
            onChange={(e) => {
              setSelectedProject(e.target.value);
              setSelectedBill('');
            }}
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

        {selectedProject && (
          <button
            onClick={() => setView('create')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Bill
          </button>
        )}
      </div>

      {selectedProject && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Bills ({bills.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading bills...</p>
            </div>
          ) : bills.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No bills found for this project</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {bills.map((bill) => (
                <div key={bill.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-lg font-semibold text-gray-900">
                          {bill.bill_number}
                        </span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(bill.status)}`}>
                          {bill.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Date:</span>
                          <p className="font-medium text-gray-900">
                            {new Date(bill.bill_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Type:</span>
                          <p className="font-medium text-gray-900">{bill.bill_type}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Amount:</span>
                          <p className="font-medium text-green-600">
                            ₹{bill.current_bill_amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedBill(bill.id);
                        setView('abstract');
                      }}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 ml-4"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Abstract
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Bills Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage and view bill abstracts for approved measurements
          </p>
        </div>

        {view === 'list' && renderBillsList()}
        {view === 'abstract' && renderAbstract()}
      </div>
    </div>
  );
};

export default BillsManagement;
