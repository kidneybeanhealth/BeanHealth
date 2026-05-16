import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Login from './Login';
import EnterpriseLogin from './EnterpriseLogin';
import AdminLogin from './AdminLogin';
import AuthChooser from './AuthChooser';
import TrialCodeVerification from './TrialCodeVerification';
import HospitalPatientLogin from './HospitalPatientLogin';
import TermsAndConditionsModal from '../modals/TermsAndConditionsModal';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import '@/styles/beanhealth-landing.css';

type AuthView = 'chooser' | 'trial-code' | 'login' | 'admin-login' | 'enterprise-login' | 'hospital-patient';

interface AuthProps {
  initialView?: AuthView;
}

const Auth: React.FC<AuthProps> = ({ initialView = 'chooser' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<AuthView>(initialView);
  const [showTerms, setShowTerms] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor' | null>(null);

  // Sync view with initialView prop when it changes
  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  // Protect /login route - redirect if trial code not verified
  useEffect(() => {
    if (initialView === 'login') {
      const isVerified = sessionStorage.getItem('beanhealth_trial_verified');
      if (!isVerified) {
        navigate('/start');
      }
    }
  }, [initialView, navigate]);

  // Dynamic document title based on view
  const getTitle = () => {
    switch (view) {
      case 'trial-code': return 'Trial Code';
      case 'login': return 'Sign In';
      case 'admin-login': return 'Admin Portal';
      case 'enterprise-login': return 'Enterprise Portal';
      case 'hospital-patient': return 'Hospital Patient Login';
      case 'chooser': default: return 'Get Started';
    }
  };

  useDocumentTitle(getTitle());

  const handleSwitchToChooser = () => {
    navigate('/');
  };

  const handleRoleSelected = (role: 'patient' | 'doctor') => {
    setSelectedRole(role);
    setView('trial-code');
  };

  const handleTrialCodeVerified = () => {
    navigate('/login');
  };

  const handleGoToEnterprise = () => {
    navigate('/enterprise');
  };

  const renderView = () => {
    switch (view) {
      case 'trial-code':
        return (
          <TrialCodeVerification
            role={selectedRole || 'patient'}
            onVerified={handleTrialCodeVerified}
            onBack={handleSwitchToChooser}
          />
        );
      case 'login':
        return <Login onSwitchToChooser={handleSwitchToChooser} />;
      case 'admin-login':
        return <AdminLogin onSwitchToChooser={handleSwitchToChooser} />;
      case 'enterprise-login':
        return <EnterpriseLogin onSwitchToChooser={handleSwitchToChooser} />;
      case 'hospital-patient':
        return <HospitalPatientLogin onSwitchToChooser={handleSwitchToChooser} />;
      case 'chooser':
      default:
        return (
          <AuthChooser
            onNext={handleRoleSelected}
            onEnterpriseLogin={handleGoToEnterprise}
            onHospitalPatientLogin={() => setView('hospital-patient')}
          />
        );
    }
  };

  return (
    <div className="page-shell min-h-screen">
      {/* Ambient orbs */}
      <div className="orb orb--one" />
      <div className="orb orb--two" />
      <div className="orb orb--three" />

      {/* Terms Modal */}
      <TermsAndConditionsModal
        isOpen={showTerms}
        onAccept={async () => setShowTerms(false)}
        viewOnly={true}
      />

      {/* Sticky navbar */}
      <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="glass-panel mx-auto flex max-w-5xl items-center justify-between rounded-full px-5 py-3">
          <a href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="BeanHealth" className="h-9 w-auto" />
          </a>
          <a
            href="/"
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-[#F0F9E6] hover:text-[#5FA01F]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28 }}
            >
              {/* Header — only on chooser */}
              {view === 'chooser' && (
                <div className="mb-8 text-center">
                  <img
                    src="/logo.png"
                    alt="BeanHealth"
                    className="mx-auto mb-5 h-14 w-auto"
                  />
                  <h1 className="text-3xl font-semibold text-slate-950">Get Started</h1>
                  <p className="mt-2 text-sm text-slate-500">
                    How would you like to use BeanHealth?
                  </p>
                </div>
              )}

              {/* Card shell — only for non-chooser views */}
              {view !== 'chooser' ? (
                <div className="glass-panel skeuomorph-card relative overflow-hidden rounded-[2.4rem] p-8">
                  {renderView()}
                </div>
              ) : (
                renderView()
              )}

              {/* Footer */}
              <p className="mt-6 text-center text-xs text-slate-400">
                By continuing you agree to BeanHealth's{' '}
                <button
                  onClick={() => setShowTerms(true)}
                  className="text-[#73BA27] underline-offset-2 hover:underline cursor-pointer"
                >
                  Terms
                </button>{' '}
                &{' '}
                <button className="text-[#73BA27] underline-offset-2 hover:underline cursor-pointer">
                  Privacy Policy
                </button>
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Auth;
