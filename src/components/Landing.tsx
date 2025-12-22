import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, BookOpen, User, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  const tiles = [
    {
      id: 'estimate',
      title: 'E-Estimate',
      description: 'Create and manage project estimates with detailed cost analysis',
      icon: FileText,
      route: '/dashboard',
      gradient: 'from-blue-600 via-blue-500 to-cyan-500',
      hoverGradient: 'hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600',
    },
    {
      id: 'measurement',
      title: 'Measurement Book',
      description: 'Track and record project measurements and progress',
      icon: BookOpen,
      route: '/mb',
      gradient: 'from-emerald-600 via-green-500 to-teal-500',
      hoverGradient: 'hover:from-emerald-700 hover:via-green-600 hover:to-teal-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <img
              src="/headerlogo.png"
              alt="ZP Chandrapur Logo"
              className="h-20 w-20 object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Zilla Parishad Chandrapur</h1>
              <p className="text-sm text-gray-600">Government of Maharashtra</p>
            </div>
          </div>

          <div className="flex items-center space-x-4 bg-white rounded-full shadow-md px-6 py-3">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-700">
                {user?.user_metadata?.full_name || user?.email}
              </span>
            </div>
            <div className="w-px h-6 bg-gray-300" />
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">
            Welcome to the e-Estimate and e-MB Management
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose your module to get started with efficient project management
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.id}
                onClick={() => navigate(tile.route)}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${tile.gradient} ${tile.hoverGradient} p-8 shadow-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl`}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 bg-white/20 rounded-full backdrop-blur-sm group-hover:bg-white/30 transition-all duration-300">
                    <Icon className="w-10 h-10 text-white" />
                  </div>

                  <h2 className="text-3xl font-bold text-white mb-4">
                    {tile.title}
                  </h2>

                  <p className="text-white/90 text-lg leading-relaxed">
                    {tile.description}
                  </p>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12 group-hover:scale-150 transition-transform duration-500" />
              </button>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <div className="inline-flex items-center space-x-4 px-6 py-4 bg-white rounded-full shadow-md">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-600">System Active</span>
            </div>
            <div className="w-px h-6 bg-gray-300" />
            <span className="text-sm text-gray-600">
              Select a module to continue
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
