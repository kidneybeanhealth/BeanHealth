import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PatientAppProvider, usePatientApp } from '../../contexts/PatientAppContext';
import { LanguageProvider, useLanguage } from '../../contexts/LanguageContext';
import PatientLoginPage from './PatientLoginPage';
import PatientConfirmation from './PatientConfirmation';
import PatientDashboard from './PatientDashboard';
import PatientTrends from './PatientTrends';
import PatientPrescriptions from './PatientPrescriptions';
import PatientBottomNav, { PatientTab } from './PatientBottomNav';
import { getProxiedUrl, supabase } from '../../lib/supabase';
import '../../styles/patient.css';

type AppStep = 'login' | 'confirm' | 'dashboard';

const ROUTE_TO_TAB: Record<string, PatientTab> = {
  '/patient-app': 'home',
  '/patient-app/history': 'trends',
  '/patient-app/prescriptions': 'prescriptions',
  '/patient-app/profile': 'profile',
};

const TAB_TO_ROUTE: Record<PatientTab, string> = {
  home: '/patient-app',
  trends: '/patient-app/history',
  prescriptions: '/patient-app/prescriptions',
  profile: '/patient-app/profile',
};

const PatientAppInner: React.FC = () => {
  const { session, logout } = usePatientApp();
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [step, setStep] = useState<AppStep>(session ? 'dashboard' : 'login');
  const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);
  const [recordSheetOpen, setRecordSheetOpen] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, behavior: 'auto' });
    return () => { window.history.scrollRestoration = prev; };
  }, []);

  // Fetch hospital logo
  useEffect(() => {
    const hospitalId = session?.hospital?.id || session?.patient?.hospital_id;
    if (!hospitalId) { setHospitalLogo(null); return; }
    let active = true;
    setHospitalLogo(null);
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('hospital_profiles').select('hospital_logo').eq('id', hospitalId).maybeSingle();
        if (active) setHospitalLogo(data?.hospital_logo ? getProxiedUrl(data.hospital_logo) : null);
      } catch { if (active) setHospitalLogo(null); }
    })();
    return () => { active = false; };
  }, [session?.hospital?.id, session?.patient?.hospital_id]);

  // After login, advance to confirm
  useEffect(() => {
    if (session && step === 'login') setStep('confirm');
  }, [session]);

  const handleConfirm = () => {
    setStep('dashboard');
    navigate('/patient-app', { replace: true });
  };

  const handleReject = () => { logout(); setStep('login'); };

  const handleLogout = () => {
    logout();
    setStep('login');
    navigate('/patient-app', { replace: true });
  };

  const openRecordSheet = useCallback(() => {
    // Navigate to home first if not there
    if (activeTab !== 'home') navigate('/patient-app');
    setRecordSheetOpen(true);
  }, [pathname]);

  const activeTab: PatientTab = ROUTE_TO_TAB[pathname] ?? 'home';

  const handleTabChange = (tab: PatientTab) => {
    navigate(TAB_TO_ROUTE[tab] ?? '/patient-app');
  };

  // ── Login
  if (step === 'login' || !session) {
    return <PatientLoginPage onLoginSuccess={() => setStep('confirm')} />;
  }

  // ── Confirmation
  if (step === 'confirm') {
    return <PatientConfirmation onConfirm={handleConfirm} onReject={handleReject} />;
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'trends': return <PatientTrends />;
      case 'prescriptions': return <PatientPrescriptions />;
      case 'profile': return <PatientProfileTab session={session} onLogout={handleLogout} />;
      default: return (
        <PatientDashboard
          recordSheetOpen={recordSheetOpen}
          onRecordSheetClose={() => setRecordSheetOpen(false)}
        />
      );
    }
  };

  return (
    <div className="pa-app patient-app">
      <div className="pa-shell">
        {/* Minimal header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)', borderBottom: '1px solid hsl(var(--border))',
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          {/* Left: logo + brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, overflow: 'hidden',
              background: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <img src={hospitalLogo || '/logo.png'} alt="BeanHealth" style={{ width: 24, height: 24, objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: 17, fontWeight: 700, color: 'hsl(var(--foreground))', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.01em' }}>
              BeanHealth
            </span>
          </div>

          {/* Right: lang toggle + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', background: 'hsl(var(--muted))', borderRadius: 20, padding: 2, gap: 2 }}>
              {(['en', 'ta'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  padding: '4px 10px', borderRadius: 18, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700,
                  background: lang === l ? 'white' : 'transparent',
                  color: lang === l ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                  boxShadow: lang === l ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease',
                  fontFamily: l === 'ta' ? 'Noto Sans Tamil, sans-serif' : 'IBM Plex Sans, sans-serif',
                }}>
                  {l === 'en' ? 'EN' : 'தமிழ்'}
                </button>
              ))}
            </div>
            <button onClick={handleLogout} style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid hsl(var(--border))',
              background: 'white', color: 'hsl(var(--muted-foreground))', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
            }}>
              {lang === 'ta' ? 'வெளியேறு' : 'Logout'}
            </button>
          </div>
        </header>

        {renderPage()}

        <PatientBottomNav activeTab={activeTab} onChange={handleTabChange} onFab={openRecordSheet} />
      </div>
    </div>
  );
};

// Simple profile tab
const PatientProfileTab: React.FC<{ session: any; onLogout: () => void }> = ({ session, onLogout }) => {
  const { lang } = useLanguage();
  const p = session.patient;
  const displayName = p.name.replace(/^(MR\.|MRS\.|MS\.|DR\.)\s*/i, '').trim();
  const initial = displayName.charAt(0).toUpperCase() || '?';
  const hospital = session.hospital;

  const rows = [
    p.mr_number && { label: 'MR Number', labelTa: 'MR எண்', value: p.mr_number },
    p.age != null && { label: 'Age', labelTa: 'வயது', value: `${p.age} yrs${p.gender ? `, ${p.gender}` : ''}` },
    p.place && { label: 'Place', labelTa: 'இடம்', value: p.place },
    p.phone && { label: 'Phone', labelTa: 'தொலைபேசி', value: p.phone },
    hospital && { label: 'Hospital', labelTa: 'மருத்துவமனை', value: hospital.display_name || hospital.hospital_name },
    session.doctor && { label: 'Doctor', labelTa: 'மருத்துவர்', value: `Dr. ${session.doctor.name}` },
  ].filter(Boolean) as { label: string; labelTa: string; value: string }[];

  return (
    <div className="pa-content" style={{ paddingBottom: '6rem' }}>
      <h1 className="text-2xl font-bold text-foreground mb-5" style={{ fontFamily: 'Outfit, sans-serif' }}>
        {lang === 'ta' ? 'சுயவிவரம்' : 'Profile'}
      </h1>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-3"
          style={{ background: 'hsl(var(--primary))' }}>
          {initial}
        </div>
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{displayName}</h2>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6"
        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        {rows.map((row, i) => (
          <div key={i} className={`flex justify-between px-5 py-3.5 ${i < rows.length - 1 ? 'border-b border-gray-100' : ''}`}>
            <span className="text-sm text-muted-foreground">{lang === 'ta' ? row.labelTa : row.label}</span>
            <span className="text-sm font-semibold text-foreground text-right max-w-[55%]" style={{ textTransform: 'capitalize' }}>{row.value}</span>
          </div>
        ))}
      </div>

      <button onClick={onLogout}
        className="w-full h-12 rounded-xl border border-red-200 text-red-500 font-semibold text-sm bg-white"
        style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
        {lang === 'ta' ? 'வெளியேறு' : 'Sign Out'}
      </button>
    </div>
  );
};

const PatientApp: React.FC = () => (
  <LanguageProvider>
    <PatientAppProvider>
      <PatientAppInner />
    </PatientAppProvider>
  </LanguageProvider>
);

export default PatientApp;
