import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  BarChart3,
  FileSpreadsheet,
  History,
  User,
  LogOut,
  Bell,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Home,
  Briefcase,
  Receipt
} from 'lucide-react';

interface UserRole {
  role_name: string;
}

interface ProjectSummary {
  total_works: number;
  active_works: number;
  completed_works: number;
  total_boq_amount: number;
  total_executed_amount: number;
  total_measurements: number;
  total_bills: number;
  pending_bills: number;
}

interface MBDashboardProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

const MBDashboard: React.FC<MBDashboardProps> = ({ onNavigate, currentPage }) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [summary, setSummary] = useState<ProjectSummary>({
    total_works: 0,
    active_works: 0,
    completed_works: 0,
    total_boq_amount: 0,
    total_executed_amount: 0,
    total_measurements: 0,
    total_bills: 0,
    pending_bills: 0
  });
  const [notifications, setNotifications] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserRoles();
    fetchDashboardSummary();
    fetchUnreadNotifications();
  }, [user]);

  const fetchUserRoles = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role_id, roles(name)')
        .eq('user_id', user.id);

      if (error) throw error;

      const roles = data?.map((ur: any) => ur.roles.name) || [];
      setUserRoles(roles);
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  };

  const fetchDashboardSummary = async () => {
    try {
      setLoading(true);

      const [projectsResponse, boqItemsResponse, measurementsResponse, billsResponse] = await Promise.all([
        supabase
          .schema('estimate')
          .from('mb_projects')
          .select('status'),
        supabase
          .schema('estimate')
          .from('mb_boq_items')
          .select('amount'),
        supabase
          .schema('estimate')
          .from('mb_measurements')
          .select('amount'),
        supabase
          .schema('estimate')
          .from('mb_bills')
          .select('current_bill_amount, approval_status')
      ]);

      const projects = projectsResponse.data || [];
      const boqItems = boqItemsResponse.data || [];
      const measurements = measurementsResponse.data || [];
      const bills = billsResponse.data || [];

      const totalProjects = projects.length;
      const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'in_progress').length;
      const completedProjects = projects.filter(p => p.status === 'completed').length;

      const totalBoqAmount = boqItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

      const totalExecutedAmount = measurements.reduce((sum, m) => {
        return sum + Number(m.amount || 0);
      }, 0);

      const totalBills = bills.length;
      const pendingBills = bills.filter(b =>
        b.approval_status === 'submitted' ||
        b.approval_status === 'in_progress' ||
        b.approval_status === 'pending'
      ).length;

      setSummary({
        total_works: totalProjects,
        active_works: activeProjects,
        completed_works: completedProjects,
        total_boq_amount: totalBoqAmount,
        total_executed_amount: totalExecutedAmount,
        total_measurements: measurements.length,
        total_bills: totalBills,
        pending_bills: pendingBills
      });
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadNotifications = async () => {
    if (!user) return;

    try {
      const { count, error } = await supabase
        .schema('estimate')
        .from('mb_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      setNotifications(count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['all'] },
    { id: 'work', label: 'Work Management', icon: Briefcase, roles: ['mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 'Executive Engineer', 'Auditor', 'Accountant', 'inspector', 'officer', 'Jr./Asst. Administration Officer', 'admin', 'super_admin', 'developer'] },
    { id: 'boq', label: 'BOQ Management', icon: FileSpreadsheet, roles: ['mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 'Executive Engineer', 'Auditor', 'Accountant', 'inspector', 'officer', 'Jr./Asst. Administration Officer', 'admin', 'super_admin', 'developer'] },
    { id: 'measurements', label: 'Measurements', icon: ClipboardList, roles: ['all'] },
    { id: 'bills', label: 'Bills', icon: Receipt, roles: ['all'] },
    { id: 'reports', label: 'Reports', icon: FileText, roles: ['mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 'Executive Engineer', 'Auditor', 'Accountant', 'inspector', 'officer', 'Jr./Asst. Administration Officer', 'admin', 'super_admin', 'developer'] },
    { id: 'audit', label: 'Audit Logs', icon: History, roles: ['mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 'Executive Engineer', 'Auditor', 'Accountant', 'inspector', 'officer', 'Jr./Asst. Administration Officer', 'admin', 'super_admin', 'developer'] },
  ];

  const canAccessPage = (pageRoles: string[]) => {
    if (pageRoles.includes('all')) return true;
    return userRoles.some(role =>
      pageRoles.includes(role) ||
      role === 'admin' ||
      role === 'super_admin' ||
      role === 'developer'
    );
  };

  const progressPercentage = summary.total_boq_amount > 0
    ? (summary.total_executed_amount / summary.total_boq_amount) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Back to Home"
              >
                <Home className="w-6 h-6" />
              </button>
              <div className="border-l border-gray-200 pl-4">
                <h1 className="text-2xl font-bold text-gray-900">Measurement Book System</h1>
                <p className="text-sm text-gray-600 mt-1">e-MB Digital Platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => onNavigate('notifications')}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <Bell className="w-6 h-6" />
                {notifications > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                    {notifications}
                  </span>
                )}
              </button>
              <div className="flex items-center space-x-3 border-l border-gray-200 pl-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                  <p className="text-xs text-gray-500">{userRoles.join(', ') || 'User'}</p>
                </div>
                <button
                  onClick={signOut}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <nav className="flex space-x-1 p-2">
            {navItems.map((item) => {
              if (!canAccessPage(item.roles)) return null;
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        {currentPage === 'dashboard' && (
          <div>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Projects</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{summary.total_works}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <LayoutDashboard className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Projects</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">{summary.active_works}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Clock className="w-8 h-8 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">{summary.completed_works}</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <CheckCircle className="w-8 h-8 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Progress</p>
                    <p className="text-3xl font-bold text-orange-600 mt-2">{progressPercentage.toFixed(1)}%</p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <TrendingUp className="w-8 h-8 text-orange-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">BOQ Financial Summary</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-600">Total BOQ Amount</span>
                    <span className="text-lg font-bold text-gray-900">
                      ₹{summary.total_boq_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-600">Executed Amount</span>
                    <span className="text-lg font-bold text-green-600">
                      ₹{summary.total_executed_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Balance Amount</span>
                    <span className="text-lg font-bold text-orange-600">
                      ₹{(summary.total_boq_amount - summary.total_executed_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Overall Progress</span>
                    <span>{progressPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Measurements Overview</h3>
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-blue-600">{summary.total_measurements}</p>
                    <p className="text-sm text-gray-600 mt-2">Total Measurements</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{summary.total_bills}</p>
                      <p className="text-xs text-gray-600 mt-1">Bills Generated</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-orange-600">{summary.pending_bills}</p>
                      <p className="text-xs text-gray-600 mt-1">Pending Bills</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  {canAccessPage(['mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 'Executive Engineer', 'Auditor', 'Accountant', 'inspector', 'officer', 'Jr./Asst. Administration Officer', 'admin', 'super_admin', 'developer']) && (
                    <button
                      onClick={() => onNavigate('work')}
                      className="flex flex-col items-center justify-center p-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                    >
                      <Briefcase className="w-6 h-6 text-indigo-600 mb-1" />
                      <span className="text-xs font-medium text-indigo-900">Manage Work</span>
                    </button>
                  )}

                  {canAccessPage(['mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 'Executive Engineer', 'Auditor', 'Accountant', 'inspector', 'officer', 'Jr./Asst. Administration Officer', 'admin', 'super_admin', 'developer']) && (
                    <button
                      onClick={() => onNavigate('boq')}
                      className="flex flex-col items-center justify-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                    >
                      <FileSpreadsheet className="w-6 h-6 text-blue-600 mb-1" />
                      <span className="text-xs font-medium text-blue-900">Upload BOQ</span>
                    </button>
                  )}

                  {canAccessPage(['mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 'Executive Engineer', 'Auditor', 'Accountant', 'inspector', 'officer', 'Jr./Asst. Administration Officer', 'admin', 'super_admin', 'developer']) && (
                    <button
                      onClick={() => onNavigate('measurements')}
                      className="flex flex-col items-center justify-center p-3 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
                    >
                      <ClipboardList className="w-6 h-6 text-green-600 mb-1" />
                      <span className="text-xs font-medium text-green-900">Add Measurement</span>
                    </button>
                  )}

                  <button
                    onClick={() => onNavigate('bills')}
                    className="flex flex-col items-center justify-center p-3 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
                  >
                    <Receipt className="w-6 h-6 text-purple-600 mb-1" />
                    <span className="text-xs font-medium text-purple-900">View Bills</span>
                  </button>

                  {canAccessPage(['mb_clerk', 'clerk', 'Junior Engineer', 'Junior Engineer (JE)', 'Deputy Engineer', 'Sub Division Engineer', 'Divisional Engineer', 'Executive Engineer', 'Auditor', 'Accountant', 'inspector', 'officer', 'Jr./Asst. Administration Officer', 'admin', 'super_admin', 'developer']) && (
                    <button
                      onClick={() => onNavigate('reports')}
                      className="flex flex-col items-center justify-center p-3 bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 transition-colors"
                    >
                      <FileText className="w-6 h-6 text-orange-600 mb-1" />
                      <span className="text-xs font-medium text-orange-900">Generate Report</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {loading && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading dashboard data...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MBDashboard;
