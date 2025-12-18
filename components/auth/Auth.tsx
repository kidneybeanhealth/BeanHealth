import React, { useState } from 'react';
import Login from './Login';
import AdminLogin from './AdminLogin';
import { LogoIcon } from '../icons/LogoIcon';
import AuthChooser from './AuthChooser';

const Auth: React.FC = () => {
  const [view, setView] = useState<'chooser' | 'login' | 'admin-login'>('chooser');

  const renderView = () => {
    switch (view) {
      case 'login':
        return <Login onSwitchToChooser={() => setView('chooser')} />;
      case 'admin-login':
        return <AdminLogin onSwitchToChooser={() => setView('chooser')} />;
      case 'chooser':
      default:
        return <AuthChooser onNext={() => setView('login')} onAdminLogin={() => setView('admin-login')} />;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col justify-center items-center p-6 lg:p-8 relative overflow-hidden">
      {/* Subtle decorative element */}
      <div className="absolute top-20 right-20 w-96 h-96 bg-gray-200/30 dark:bg-gray-800/30 rounded-full blur-3xl"></div>

      <div className="relative z-10 w-full max-w-4xl">
        {/* Logo Header - Minimal */}
        <div className="flex justify-center items-center gap-4 mb-12 animate-fade-in">
          <div className="bg-[#3D2820] p-3.5 rounded-2xl">
            <LogoIcon className="h-10 w-10" />
          </div>
          <h1 className="text-5xl lg:text-6xl font-semibold tracking-tight">
            <span className="text-[#3D2820] dark:text-[#e6b8a3]">Bean</span>
            <span className="text-[#7CB342]">Health</span>
          </h1>
        </div>

        {/* Auth Card - Minimal */}
        <div className="bg-white dark:bg-gray-900 backdrop-blur-xl p-10 lg:p-12 rounded-3xl border border-gray-200/60 dark:border-gray-800 transition-all duration-300 animate-scale-in">
          {renderView()}
        </div>

        {/* Footer Text - Minimal */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8 px-4 animate-fade-in">
          By continuing, you agree to our{' '}
          <button className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:underline font-medium transition-colors">
            Terms of Service
          </button>
          {' '}and{' '}
          <button className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:underline font-medium transition-colors">
            Privacy Policy
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
