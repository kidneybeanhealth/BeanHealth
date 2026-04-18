/**
 * Patient App — Main shell with auth flow + dashboard
 * Entry point: MR Login → Confirmation → Dashboard (3 tabs)
 * 
 * Language: Tamil (default) ↔ English toggle in header
 */
import React, { useState, useEffect } from 'react';
import { PatientAppProvider, usePatientApp } from '../../contexts/PatientAppContext';
import { LanguageProvider, useLanguage } from '../../contexts/LanguageContext';
import PatientMRLogin from './PatientMRLogin';
import PatientConfirmation from './PatientConfirmation';
import PatientHome from './PatientHome';
import PatientTrends from './PatientTrends';
import PatientPrescriptions from './PatientPrescriptions';
import PatientBottomNav, { PatientTab } from './PatientBottomNav';
import { getProxiedUrl, supabase } from '../../lib/supabase';
import '../../styles/patient.css';

type AppStep = 'login' | 'confirm' | 'dashboard';

/** Language Toggle — Pill-style த | EN switch */
const LanguageToggle: React.FC = () => {
  const { lang, setLang } = useLanguage();

  return (
    <div className="pa-lang-toggle" title="Switch Language">
      <button
        className={`pa-lang-btn ${lang === 'ta' ? 'active' : ''}`}
        onClick={() => setLang('ta')}
      >
        த
      </button>
      <button
        className={`pa-lang-btn ${lang === 'en' ? 'active' : ''}`}
        onClick={() => setLang('en')}
      >
        EN
      </button>
    </div>
  );
};

const PatientAppInner: React.FC = () => {
  const { session, logout } = usePatientApp();
  const { t, lang } = useLanguage();
  const [step, setStep] = useState<AppStep>(session ? 'dashboard' : 'login');
  const [activeTab, setActiveTab] = useState<PatientTab>('home');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }

    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const hospitalId = session?.hospital?.id || session?.patient?.hospital_id;
    if (!hospitalId) {
      setHospitalLogo(null);
      return;
    }

    let isActive = true;
    setHospitalLogo(null);

    const fetchHospitalLogo = async () => {
      try {
        const { data } = await (supabase as any)
          .from('hospital_profiles')
          .select('hospital_logo')
          .eq('id', hospitalId)
          .maybeSingle();

        if (!isActive) return;
        setHospitalLogo(data?.hospital_logo ? getProxiedUrl(data.hospital_logo) : null);
      } catch (error) {
        if (isActive) {
          setHospitalLogo(null);
        }
      }
    };

    fetchHospitalLogo();

    return () => {
      isActive = false;
    };
  }, [session?.hospital?.id, session?.patient?.hospital_id]);

  // When session changes (login success), go to confirm
  useEffect(() => {
    if (session && step === 'login') {
      setStep('confirm');
    }
  }, [session]);

  const handleConfirm = () => setStep('dashboard');

  const handleReject = () => {
    logout();
    setStep('login');
  };

  const handleLogout = () => {
    logout();
    setStep('login');
    setActiveTab('home');
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return t('greeting.morning');
    if (hour < 17) return t('greeting.afternoon');
    return t('greeting.evening');
  };

  const dateLocale = lang === 'ta' ? 'ta-IN' : 'en-IN';

  const formatDate = () =>
    currentTime.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' });

  const formatTime = () =>
    currentTime.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });

  // ── Login Step
  if (step === 'login' || !session) return <PatientMRLogin />;

  // ── Confirmation Step
  if (step === 'confirm') return <PatientConfirmation onConfirm={handleConfirm} onReject={handleReject} />;

  // ── Dashboard Step
  const patientName = session.patient.name
    .replace(/^(MR\.|MRS\.|MS\.|DR\.)\s*/i, '')
    .split(' ')[0];

  const renderTab = () => {
    switch (activeTab) {
      case 'home': return <PatientHome />;
      case 'trends': return <PatientTrends />;
      case 'prescriptions': return <PatientPrescriptions />;
      default: return <PatientHome />;
    }
  };

  return (
    <div className="pa-app">
      <div className="pa-shell">
        {/* Header */}
        <div className="pa-header">
          <div className="pa-header-top">
            <div className="pa-header-left">
              {/* Logo */}
              <div className="pa-header-logo">
                <img src={hospitalLogo || '/logo.png'} alt="Hospital Logo" />
              </div>
              {/* Brand name — visible on ≥640px */}
              <div className="pa-header-brand-name">
                Bean<span>Health</span>
              </div>
              {/* Greeting + Name + Date/Time */}
              <div className="pa-header-info">
                <div className="pa-greeting">{getGreeting()}</div>
                <div className="pa-header-name">{patientName}</div>
                <div className="pa-header-date">
                  {formatDate()} · <span className="pa-header-time">{formatTime()}</span>
                </div>
              </div>
            </div>
            {/* Language Toggle + Logout */}
            <div className="pa-header-actions">
              <LanguageToggle />
              <button className="pa-logout-btn" onClick={handleLogout} title="Logout">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {renderTab()}

        {/* Bottom Navigation */}
        <PatientBottomNav activeTab={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  );
};

// Provider wrapper — LanguageProvider wraps everything
const PatientApp: React.FC = () => (
  <LanguageProvider>
    <PatientAppProvider>
      <PatientAppInner />
    </PatientAppProvider>
  </LanguageProvider>
);

export default PatientApp;
