import React, { useState } from 'react';
import { FileEdit, CheckCircle } from 'lucide-react';
import MeasurementEntry from './MeasurementEntry';
import MBStatus from './MBStatus';

interface MeasurementsProps {
  onNavigate: (page: string) => void;
}

const Measurements: React.FC<MeasurementsProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'entry' | 'status'>('entry');

  const tabs = [
    { id: 'entry', label: 'Measurement Entry', icon: FileEdit },
    { id: 'status', label: 'Approval Status', icon: CheckCircle },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'entry' | 'status')}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        {activeTab === 'entry' && <MeasurementEntry onNavigate={onNavigate} />}
        {activeTab === 'status' && <MBStatus onNavigate={onNavigate} />}
      </div>
    </div>
  );
};

export default Measurements;
