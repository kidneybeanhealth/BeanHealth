import React, { useState } from 'react';
import Login from './Login';
import EnterpriseLogin from './EnterpriseLogin';
import AdminLogin from './AdminLogin';
import AuthChooser from './AuthChooser';
import TermsAndConditionsModal from '../TermsAndConditionsModal';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';


const Auth: React.FC = () => {
  const [view, setView] = useState<'chooser' | 'login' | 'admin-login' | 'enterprise-login'>('chooser');
  const [showTerms, setShowTerms] = useState(false);

  // Dynamic document title based on view
  const getTitle = () => {
    switch (view) {
      case 'login': return 'Sign In';
      case 'admin-login': return 'Admin Portal';
      case 'enterprise-login': return 'Enterprise Portal';
      case 'chooser': default: return 'Get Started';
    }
  };

  useDocumentTitle(getTitle());

  const renderView = () => {
    switch (view) {
      case 'login':
        return <Login onSwitchToChooser={() => setView('chooser')} />;
      case 'admin-login':
        return <AdminLogin onSwitchToChooser={() => setView('chooser')} />;
      case 'enterprise-login':
        return <EnterpriseLogin onSwitchToChooser={() => setView('chooser')} />;
      case 'chooser':
      default:
        return <AuthChooser onNext={() => setView('login')} onEnterpriseLogin={() => setView('enterprise-login')} />;
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6"
      style={{
        background: 'linear-gradient(135deg, #f8faf6 0%, #e8f5e0 50%, #f0f7ec 100%)'
      }}
    >
      {/* Terms Modal - View Only */}
      <TermsAndConditionsModal
        isOpen={showTerms}
        onAccept={async () => setShowTerms(false)}
        viewOnly={true}
      />

      <div className="w-full max-w-sm sm:max-w-md">
        {/* Logo & Branding - Hero Vertical Layout */}
        <div className="flex flex-col items-center justify-center gap-1 mb-10 animate-fade-in">
          <div className="w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0 relative transition-transform duration-700 hover:scale-105">
            <img
              src="/logo.png"
              alt="BeanHealth Logo"
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight !text-gray-900 leading-none text-center">
            <span className="text-primary-500">Bean</span>
            <span className="text-secondary-500">Health</span>
          </h1>
        </div>

        {/* Auth Card - Elevated - Forces Light Theme */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white shadow-[0_4px_24px_rgba(138,196,60,0.08),0_1px_3px_rgba(0,0,0,0.04)] border border-transparent">
          {renderView()}
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6 text-gray-400">
          By continuing, you agree to our{' '}
          <button
            onClick={() => setShowTerms(true)}
            className="underline hover:text-secondary-500 transition-colors"
          >
            Terms
          </button>
          {' '}and{' '}
          <button className="underline hover:text-secondary-500 transition-colors">Privacy Policy</button>
        </p>
      </div >
    </div >
  );
};

export default Auth;
