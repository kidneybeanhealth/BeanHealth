import React, { useState } from 'react';
import Login from './Login';
import AdminLogin from './AdminLogin';
import AuthChooser from './AuthChooser';
import TermsAndConditionsModal from '../TermsAndConditionsModal';

const Auth: React.FC = () => {
  const [view, setView] = useState<'chooser' | 'login' | 'admin-login'>('chooser');
  const [showTerms, setShowTerms] = useState(false);

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
        {/* Logo & Branding - Compact */}
        <div className="text-center mb-6">
          <div className="inline-block">
            <img 
              src="/beanhealth-logo.png" 
              alt="BeanHealth" 
              className="h-72 sm:h-80 w-auto mx-auto"
              style={{ marginBottom: '-140px' }}
            />
          </div>
          <h1 className="mb-1">
            <span style={{ 
              color: '#3a2524', 
              fontWeight: 700, 
              fontSize: '26px', 
              fontStyle: 'italic',
              letterSpacing: '-0.5px'
            }}>Bean</span>
            <span style={{ 
              color: '#8AC43C', 
              fontWeight: 700, 
              fontSize: '26px', 
              fontStyle: 'italic',
              letterSpacing: '-0.5px'
            }}> Health</span>
          </h1>
          <p style={{ 
            color: '#7a8a70', 
            fontSize: '12px', 
            fontStyle: 'italic', 
            fontWeight: 400,
            letterSpacing: '0.5px'
          }}>
            Continuous. Connected. Complete.
          </p>
        </div>

        {/* Auth Card - Elevated */}
        <div 
          className="p-6 sm:p-8 rounded-3xl"
          style={{ 
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 24px rgba(138, 196, 60, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)'
          }}
        >
          {renderView()}
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: '#9ca3af' }}>
          By continuing, you agree to our{' '}
          <button 
            onClick={() => setShowTerms(true)}
            className="underline hover:text-[#8AC43C] transition-colors"
          >
            Terms
          </button>
          {' '}and{' '}
          <button className="underline hover:text-[#8AC43C] transition-colors">Privacy Policy</button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
