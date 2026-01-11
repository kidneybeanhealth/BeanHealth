import React, { useState } from 'react';
import Login from './Login';
import AdminLogin from './AdminLogin';
import AuthChooser from './AuthChooser';
import ClinicLogin from './ClinicLogin';
import TermsAndConditionsModal from '../TermsAndConditionsModal';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { DoctorIcon } from '../icons/DoctorIcon';
import { UserIcon } from '../icons/UserIcon';

type AuthView = 'landing' | 'individual-chooser' | 'individual-login' | 'clinic-login' | 'admin-login';

const Auth: React.FC = () => {
  const [view, setView] = useState<AuthView>('landing');
  const [showTerms, setShowTerms] = useState(false);

  // Dynamic document title based on view
  const getTitle = () => {
    switch (view) {
      case 'individual-login': return 'Sign In';
      case 'clinic-login': return 'Clinic Portal';
      case 'admin-login': return 'Admin Portal';
      case 'individual-chooser': return 'Get Started';
      case 'landing': default: return 'Welcome to BeanHealth';
    }
  };

  useDocumentTitle(getTitle());

  // Render the landing page with dual cards
  const renderLanding = () => (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Individual Card */}
      <div className="flex-1 p-6 sm:p-8 rounded-3xl bg-white shadow-[0_4px_24px_rgba(138,196,60,0.08),0_1px_3px_rgba(0,0,0,0.04)] border border-transparent">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary-50 text-secondary-600 text-sm font-medium mb-4">
            <UserIcon className="w-4 h-4" />
            <span>For Individuals</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            BeanHealth Individual
          </h2>
          <p className="text-sm text-gray-500">
            Personal health tracking for patients & doctors
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {/* Patient Option */}
          <button
            onClick={() => setView('individual-chooser')}
            className="w-full p-4 rounded-2xl border-2 border-gray-200 bg-gray-50 hover:border-secondary-300 hover:bg-secondary-50/50 transition-all duration-200 text-left flex items-center gap-4 group"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary-100 text-secondary-500 flex items-center justify-center group-hover:bg-secondary-200 transition-colors">
              <UserIcon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base text-gray-900">I'm a Patient</h3>
              <p className="text-xs text-gray-500">Track health & connect with doctors</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-secondary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Doctor Option */}
          <button
            onClick={() => setView('individual-chooser')}
            className="w-full p-4 rounded-2xl border-2 border-gray-200 bg-gray-50 hover:border-secondary-300 hover:bg-secondary-50/50 transition-all duration-200 text-left flex items-center gap-4 group"
          >
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
              <DoctorIcon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base text-gray-900">I'm a Doctor</h3>
              <p className="text-xs text-gray-500">Manage patients remotely</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-secondary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">
          Uses Google authentication
        </p>
      </div>

      {/* Clinic/Enterprise Card */}
      <div className="flex-1 p-6 sm:p-8 rounded-3xl bg-white shadow-[0_4px_24px_rgba(138,196,60,0.08),0_1px_3px_rgba(0,0,0,0.04)] border border-transparent">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 text-primary-600 text-sm font-medium mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span>For Clinics</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            BeanHealth Clinic
          </h2>
          <p className="text-sm text-gray-500">
            Complete clinic management solution
          </p>
        </div>

        <button
          onClick={() => setView('clinic-login')}
          className="w-full p-4 rounded-2xl border-2 border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/50 transition-all duration-200 text-left flex items-center gap-4 group mb-6"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-base text-gray-900">Enterprise Login</h3>
            <p className="text-xs text-gray-500">Reception, Doctor & Pharmacy dashboards</p>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-2">Includes:</p>
          <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Reception
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Doctors
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Pharmacy
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderView = () => {
    switch (view) {
      case 'landing':
        return renderLanding();
      case 'individual-chooser':
        return (
          <div className="w-full max-w-sm sm:max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-white shadow-[0_4px_24px_rgba(138,196,60,0.08),0_1px_3px_rgba(0,0,0,0.04)] border border-transparent">
            <AuthChooser onNext={() => setView('individual-login')} onAdminLogin={() => setView('admin-login')} />
          </div>
        );
      case 'individual-login':
        return (
          <div className="w-full max-w-sm sm:max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-white shadow-[0_4px_24px_rgba(138,196,60,0.08),0_1px_3px_rgba(0,0,0,0.04)] border border-transparent">
            <Login onSwitchToChooser={() => setView('individual-chooser')} />
          </div>
        );
      case 'clinic-login':
        return (
          <div className="w-full max-w-sm sm:max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-white shadow-[0_4px_24px_rgba(138,196,60,0.08),0_1px_3px_rgba(0,0,0,0.04)] border border-transparent">
            <ClinicLogin onBack={() => setView('landing')} />
          </div>
        );
      case 'admin-login':
        return (
          <div className="w-full max-w-sm sm:max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-white shadow-[0_4px_24px_rgba(138,196,60,0.08),0_1px_3px_rgba(0,0,0,0.04)] border border-transparent">
            <AdminLogin onSwitchToChooser={() => setView('landing')} />
          </div>
        );
      default:
        return renderLanding();
    }
  };

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

      <div className={`w-full ${view === 'landing' ? 'max-w-4xl' : 'max-w-sm sm:max-w-md'}`}>
        {/* Logo & Branding - Hero Vertical Layout */}
        <div className="flex flex-col items-center justify-center gap-1 mb-10 animate-fade-in">
          <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 relative transition-transform duration-700 hover:scale-105">
            <img
              src="/logo.png"
              alt="BeanHealth Logo"
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight !text-gray-900 leading-none text-center">
            <span className="text-primary-500">Bean</span>
            <span className="text-secondary-500">Health</span>
          </h1>
        </div>

        {/* Auth Content */}
        {renderView()}

        {/* Back to Landing Button - only show when not on landing */}
        {view !== 'landing' && (
          <button
            onClick={() => setView('landing')}
            className="flex items-center justify-center gap-2 mx-auto mt-6 text-sm text-gray-500 hover:text-secondary-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to options</span>
          </button>
        )}

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-gray-400">
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
          {view === 'landing' && (
            <button
              onClick={() => setView('admin-login')}
              className="text-xs text-gray-400 hover:text-secondary-500 transition-colors hover:underline"
            >
              Admin Access
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
