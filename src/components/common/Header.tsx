import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useYear, YEAR_OPTIONS } from '../../contexts/YearContext';
import { supabase } from '../../lib/supabase';
import { User, LogOut, Home, FileCheck, FileSpreadsheet, Calendar, Bell, GitBranch } from 'lucide-react';

const Header: React.FC = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const { selectedYear, setSelectedYear } = useYear();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user) fetchPendingCount();
    const interval = setInterval(() => { if (user) fetchPendingCount(); }, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchPendingCount = async () => {
    try {
      const { data: roleData } = await supabase
        .schema('public').from('user_roles').select('roles(name)').eq('user_id', user!.id).maybeSingle();
      const roleName = roleData?.roles && (Array.isArray(roleData.roles) ? (roleData.roles[0] as any)?.name : (roleData.roles as any).name);
      const isAdmin = roleName === 'super_admin' || roleName === 'developer';

      let q = supabase.schema('estimate').from('approval_workflows').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval');
      if (!isAdmin) q = q.eq('current_approver_id', user!.id);
      const { count } = await q;
      setPendingCount(count || 0);
    } catch (_) {}
  };

  const navigationItems = [
    { key: 'home', path: '/', label: 'Home', gradient: 'from-slate-500 to-gray-600', showIcon: true, icon: Home },
    { key: 'dashboard', path: '/dashboard', label: 'Dashboard', gradient: 'from-indigo-500 to-blue-600' },
    { key: 'works', path: '/works', label: t('nav.works'), gradient: 'from-emerald-500 to-teal-600' },
    { key: 'subworks', path: '/subworks', label: t('nav.subworks'), gradient: 'from-purple-500 to-pink-600' },
    { key: 'generate-estimate', path: '/generate-estimate', label: 'Generate E-Estimate', gradient: 'from-violet-500 to-purple-600' },
    { key: 'approvals', path: '/approvals', label: 'Approvals', gradient: 'from-green-500 to-teal-600', showIcon: true, icon: FileCheck },
    { key: 'workflow-dashboard', path: '/workflow-dashboard', label: 'Workflow', gradient: 'from-blue-600 to-blue-800', showIcon: true, icon: GitBranch },
    { key: 'boq-generation', path: '/boq-generation', label: 'BOQ Generation', gradient: 'from-orange-500 to-amber-600', showIcon: true, icon: FileSpreadsheet },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleNavigation = (path: string) => {
    window.location.href = path;
  };

  return (
    <header className="bg-gradient-to-r from-slate-50 to-gray-100 shadow-xl border-b border-slate-200">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-12">
          <button
            onClick={() => handleNavigation('/')}
            className="flex items-center space-x-4 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="flex-shrink-0">
              <img src="/headerlogo.png" alt="ZP Chandrapur" className="w-10 h-10 object-contain rounded-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-wide">E-Estimate</h1>
              <p className="text-xs text-gray-500">ZP Chandrapur</p>
            </div>
          </button>

          <div className="flex items-center space-x-3">
            {/* Year Filter */}
            <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
              <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="text-sm font-medium text-gray-700 bg-transparent border-none outline-none cursor-pointer"
              >
                <option value="all">All Years</option>
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Bell icon */}
            <button
              onClick={() => handleNavigation('/approvals')}
              className="relative p-2 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
              title={`${pendingCount} approvals pending`}
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>

            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-700">
                {user?.user_metadata?.full_name || user?.email}
              </span>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center space-x-1 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:text-red-600"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('nav.signOut')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="border-t border-slate-200 bg-gradient-to-r from-slate-100 to-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-2 py-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isApprovals = item.key === 'approvals';
              return (
                <button
                  key={item.key}
                  onClick={() => handleNavigation(item.path)}
                  className={`relative px-6 py-3 rounded-xl text-base font-bold transition-all duration-300 flex items-center space-x-2 ${
                    location.pathname === item.path
                      ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg scale-105`
                      : 'text-gray-700 hover:text-gray-900 hover:bg-white/60 hover:scale-105 hover:shadow-md'
                  }`}
                >
                  {item.showIcon && Icon && <Icon className="w-4 h-4" />}
                  <span>{item.label}</span>
                  {isApprovals && pendingCount > 0 && (
                    <span className="ml-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-slate-200 bg-gradient-to-r from-slate-100 to-gray-200">
        <div className="px-2 py-3 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => handleNavigation(item.path)}
                className={`block w-full text-left px-6 py-3 rounded-xl text-base font-bold transition-all duration-300 flex items-center space-x-2 ${
                  location.pathname === item.path
                    ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg`
                    : 'text-gray-700 hover:text-gray-900 hover:bg-white/60 hover:shadow-md'
                }`}
              >
                {item.showIcon && Icon && <Icon className="w-4 h-4" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

export default Header;
