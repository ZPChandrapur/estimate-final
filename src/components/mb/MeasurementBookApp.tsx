import React, { useState } from 'react';
import MBDashboard from './MBDashboard';
import WorkManagement from './WorkManagement';
import BOQManagement from './BOQManagement';
import MeasurementEntry from './MeasurementEntry';
import MBStatus from './MBStatus';
import MBReports from './MBReports';
import MBAuditLogs from './MBAuditLogs';

const MeasurementBookApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <MBDashboard onNavigate={setCurrentPage} currentPage={currentPage} />;
      case 'work':
        return <WorkManagement onNavigate={setCurrentPage} />;
      case 'boq':
        return <BOQManagement onNavigate={setCurrentPage} />;
      case 'measurements':
        return <MeasurementEntry onNavigate={setCurrentPage} />;
      case 'status':
        return <MBStatus onNavigate={setCurrentPage} />;
      case 'reports':
        return <MBReports onNavigate={setCurrentPage} />;
      case 'audit':
        return <MBAuditLogs onNavigate={setCurrentPage} />;
      default:
        return <MBDashboard onNavigate={setCurrentPage} currentPage={currentPage} />;
    }
  };

  return <div className="min-h-screen bg-gray-50">{renderPage()}</div>;
};

export default MeasurementBookApp;
