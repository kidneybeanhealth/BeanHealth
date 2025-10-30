import React, { useState } from 'react';
import Login from './Login';
import { LogoIcon } from '../icons/LogoIcon';
import AuthChooser from './AuthChooser';

const Auth: React.FC = () => {
  const [view, setView] = useState<'chooser' | 'login'>('chooser');

  const renderView = () => {
    switch(view) {
        case 'login':
            return <Login onSwitchToChooser={() => setView('chooser')} />;
        case 'chooser':
        default:
            return <AuthChooser onNext={() => setView('login')} />;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Decorative background elements - animated blobs */}
      <div className="absolute top-20 left-10 w-64 h-64 sm:w-80 sm:h-80 bg-sky-400/10 dark:bg-rose-900/5 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-400/10 dark:bg-indigo-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/4 w-48 h-48 sm:w-64 sm:h-64 bg-purple-400/5 dark:bg-purple-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      
      <div className="relative z-10 w-full max-w-5xl">
        {/* Logo Header */}
        <div className="flex flex-col sm:flex-row justify-center items-center mb-8 sm:mb-12 space-y-3 sm:space-y-0 sm:space-x-4 animate-fade-in">
          <div className="bg-gradient-to-br from-rose-500 to-rose-900 p-3 sm:p-3.5 rounded-2xl shadow-lg ring-1 ring-white/20">
            <LogoIcon className="h-10 w-10 sm:h-11 sm:w-11 text-white"/>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            BeanHealth
          </h1>
        </div>
        
        {/* Auth Card */}
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl p-6 sm:p-10 lg:p-12 rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200/60 dark:border-gray-700/60 transition-all duration-300 animate-scale-in">
          {renderView()}
        </div>
        
        {/* Footer Text */}
        <p className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-6 sm:mt-8 px-4 animate-fade-in">
          By continuing, you agree to our{' '}
          <button className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline font-medium transition-colors">
            Terms of Service
          </button>
          {' '}and{' '}
          <button className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline font-medium transition-colors">
            Privacy Policy
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
