import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { FileText, Plus, Eye, Download, ArrowLeft, Send, CheckCircle, XCircle, BarChart2 } from 'lucide-react';
import BillProgressChart from './BillProgressChart';

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
  approval_status: string;
  total_amount: number;
  current_bill_amount: number;
  project_id: string;
  current_approval_level: number;
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
  const [view, setView] = useState<'list' | 'create' | 'abstract' | 'progress'>('list');
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    fetchProjects();
    fetchUserRoles();
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

  const fetchUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role_id, roles(name)')
        .eq('user_id', user?.id);

      if (error) throw error;
      const roles = data?.map((ur: any) => ur.roles?.name).filter(Boolean) || [];
      setUserRoles(roles);
    } catch (error) {
      console.error('Error fetching user roles:', error);
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
      case 'je_checked': return 'bg-blue-200 text-blue-900';
      case 'de_checked': return 'bg-blue-300 text-blue-900';
      case 'auditor_checked': return 'bg-blue-400 text-blue-900';
      case 'jed_checked': return 'bg-blue-500 text-white';
      case 'account_checked': return 'bg-blue-600 text-white';
      case 'dee_checked': return 'bg-blue-700 text-white';
      case 'ee_approved': return 'bg-green-100 text-green-800';
      case 'sent_back': return 'bg-orange-100 text-orange-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSubmitForApproval = async (billId: string, projectId: string) => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .rpc('initiate_bill_approval', {
          p_bill_id: billId,
          p_project_id: projectId
        });

      if (error) throw error;

      if (data?.success) {
        alert('Bill submitted for approval successfully');
        fetchBills();
      } else {
        alert('Error: ' + (data?.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error submitting bill:', error);
      alert('Error submitting bill: ' + error.message);
    }
  };

  const canApprove = (bill: Bill) => {
    const roleApprovalMap: { [key: string]: number } = {
      'Junior Engineer': 2,
      'Junior Engineer (JE)': 2,
      'Deputy Engineer': 3,
      'Auditor': 4,
      'JE(D)': 5,
      'Accountant': 6,
      'Account': 6,
      'DEE': 7,
      'Executive Engineer': 8,
      'admin': 999,
      'super_admin': 999,
      'developer': 999
    };

    const userLevel = Math.max(...userRoles.map(role => roleApprovalMap[role] || 0));
    return userLevel >= (bill.current_approval_level + 1) && bill.approval_status !== 'ee_approved';
  };

  const handleCreateBill = async () => {
    if (!selectedProject) return;

    const confirm = window.confirm('This will generate a new RA Bill from approved measurements. Continue?');
    if (!confirm) return;

    try {
      setLoading(true);

      // Get the latest bill number for the project
      const { data: existingBills, error: billError } = await supabase
        .schema('estimate')
        .from('mb_bills')
        .select('bill_number')
        .eq('project_id', selectedProject)
        .order('created_at', { ascending: false })
        .limit(1);

      if (billError) throw billError;

      const lastBillNumber = existingBills && existingBills.length > 0
        ? parseInt(existingBills[0].bill_number.split('-').pop() || '0')
        : 0;
      const newBillNumber = `RABill-${lastBillNumber + 1}`;

      // Get all approved measurements (BOQ items with executed quantities)
      const { data: boqData, error: boqError } = await supabase
        .schema('estimate')
        .from('mb_boq')
        .select('*')
        .eq('project_id', selectedProject);

      if (boqError) throw boqError;

      if (!boqData || boqData.length === 0) {
        alert('No BOQ items found for this project. Please add measurements first.');
        return;
      }

      // Get previous bills total to calculate current bill amount
      const { data: prevBills, error: prevError } = await supabase
        .schema('estimate')
        .from('mb_bills')
        .select('id')
        .eq('project_id', selectedProject);

      if (prevError) throw prevError;

      // Calculate total amount and create bill
      const totalAmount = boqData.reduce((sum, item) => {
        const executedQty = item.executed_qty || 0;
        const rate = item.rate || 0;
        return sum + (executedQty * rate);
      }, 0);

      // Create the bill
      const { data: newBill, error: createError } = await supabase
        .schema('estimate')
        .from('mb_bills')
        .insert({
          project_id: selectedProject,
          bill_number: newBillNumber,
          bill_date: new Date().toISOString().split('T')[0],
          bill_type: 'RA Bill',
          status: 'draft',
          approval_status: 'draft',
          total_amount: totalAmount,
          current_bill_amount: totalAmount,
          no_of_mb_entries: boqData.length,
          wdmm_amount: 0,
          current_approval_level: 0
        })
        .select()
        .single();

      if (createError) throw createError;

      // Create bill items from BOQ
      const billItems = boqData.map(item => {
        const executedQty = item.executed_qty || 0;
        const rate = item.rate || 0;
        const amount = executedQty * rate;

        return {
          bill_id: newBill.id,
          boq_item_id: item.id,
          total_qty_till_now: executedQty,
          prev_qty_upto_previous_bill: 0,
          qty_now_to_be_paid: executedQty,
          rate: rate,
          bill_rate: rate,
          amount: amount,
          is_clause_38: item.is_clause_38 || false
        };
      });

      const { error: itemsError } = await supabase
        .schema('estimate')
        .from('mb_bill_items')
        .insert(billItems);

      if (itemsError) throw itemsError;

      alert('RA Bill generated successfully!');
      fetchBills();
    } catch (error: any) {
      console.error('Error creating bill:', error);
      alert('Error creating bill: ' + error.message);
    } finally {
      setLoading(false);
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
            onClick={handleCreateBill}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate RA Bill
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
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(bill.approval_status || bill.status)}`}>
                          {bill.approval_status === 'draft' ? 'Draft' :
                           bill.approval_status === 'submitted' ? 'Submitted' :
                           bill.approval_status === 'je_checked' ? 'JE Checked' :
                           bill.approval_status === 'de_checked' ? 'DE Checked' :
                           bill.approval_status === 'auditor_checked' ? 'Auditor Checked' :
                           bill.approval_status === 'jed_checked' ? 'JE(D) Checked' :
                           bill.approval_status === 'account_checked' ? 'Account Checked' :
                           bill.approval_status === 'dee_checked' ? 'DEE Checked' :
                           bill.approval_status === 'ee_approved' ? 'EE Approved' :
                           bill.approval_status === 'sent_back' ? 'Sent Back' :
                           bill.approval_status === 'rejected' ? 'Rejected' :
                           bill.status}
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

                    <div className="flex items-center space-x-2 ml-4">
                      {bill.approval_status === 'draft' && (
                        <button
                          onClick={() => handleSubmitForApproval(bill.id, bill.project_id)}
                          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Submit for Approval
                        </button>
                      )}
                      {bill.approval_status !== 'draft' && (
                        <button
                          onClick={() => {
                            setSelectedBill(bill.id);
                            setView('progress');
                          }}
                          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700"
                        >
                          <BarChart2 className="w-4 h-4 mr-2" />
                          Progress Chart
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedBill(bill.id);
                          setView('abstract');
                        }}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Abstract
                      </button>
                    </div>
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => onNavigate('dashboard')}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </button>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">Bills Management</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage and view RA Bill abstracts for approved measurements
            </p>
          </div>
        </div>

        {view === 'list' && renderBillsList()}
        {view === 'abstract' && renderAbstract()}
        {view === 'progress' && selectedBill && (
          <BillProgressChart
            billId={selectedBill}
            onBack={() => {
              setView('list');
              setSelectedBill('');
            }}
          />
        )}
      </div>
    </div>
  );
};

export default BillsManagement;
