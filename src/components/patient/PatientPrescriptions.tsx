/**
 * Patient Prescriptions Tab — Tap to open the actual PrescriptionModal (same as enterprise)
 * Supports Tamil (default) ↔ English
 */
import React, { useEffect, useState } from 'react';
import { usePatientApp } from '../../contexts/PatientAppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import PrescriptionModal from '../modals/PrescriptionModal';

const FileIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const PatientPrescriptions: React.FC = () => {
  const { prescriptions, refreshPrescriptions, session } = usePatientApp();
  const { t, lang } = useLanguage();
  const [selectedRx, setSelectedRx] = useState<any | null>(null);
  const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      if (selectedRx) {
        setSelectedRx(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedRx]);

  const openRx = (rx: any) => {
    window.history.pushState({ modalOpen: true }, '');
    setSelectedRx(rx);
  };

  const closeRx = () => {
    if (window.history.state?.modalOpen) {
      window.history.back();
    } else {
      setSelectedRx(null);
    }
  };

  useEffect(() => { refreshPrescriptions(); }, []);

  useEffect(() => {
    if (session?.patient?.hospital_id) {
      const fetchLogo = async () => {
        try {
          const { data } = await (supabase as any)
            .from('hospital_profiles')
            .select('avatar_url')
            .eq('id', session.patient.hospital_id)
            .maybeSingle();
          if (data?.avatar_url) setHospitalLogo(data.avatar_url);
        } catch (e) {
          console.warn('Could not fetch hospital logo for patient app', e);
        }
      };
      fetchLogo();
    }
  }, [session?.patient?.hospital_id]);

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' }); }
    catch { return d; }
  };
  const fmtTime = (d: string) => {
    try { return new Date(d).toLocaleTimeString(lang === 'ta' ? 'ta-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  if (prescriptions.length === 0) {
    return (
      <div className="pa-content">
        <div className="pa-empty">
          <div className="pa-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <p className="pa-empty-text">{t('rx.empty')}</p>
          <p className="pa-empty-subtext">{t('rx.emptySubtext')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="pa-content">
        <p style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 12 }}>
          {prescriptions.length} {prescriptions.length !== 1 ? t('rx.prescriptions') : t('rx.prescription')}
        </p>
        {prescriptions.map((rx, i) => (
          <div key={rx.id} onClick={() => openRx(rx)} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', marginBottom: 8,
            background: '#fff', borderRadius: 12, border: '1px solid #F3F4F6',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)', cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            animation: `pa-card-enter 0.3s ease ${i * 0.05}s both`,
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileIcon /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{fmtDate(rx.created_at)}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginTop: 2 }}>
                {fmtTime(rx.created_at)}{rx.doctor?.name && ` · Dr. ${rx.doctor.name}`}
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#6EA530', background: '#F0F7E6', padding: '3px 8px', borderRadius: 6 }}>
              {(rx.medications || []).length} {t('rx.meds')}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </div>
        ))}
      </div>
      {selectedRx && (
        <PrescriptionModal
          doctor={selectedRx.doctor || { name: '', specialty: '' }}
          patient={session?.patient || { name: '', mr_number: '', age: '' }}
          onClose={closeRx}
          readOnly={true} forceDesktop={true} existingData={selectedRx}
          clinicLogo={hospitalLogo || undefined}
        />
      )}
    </>
  );
};

export default PatientPrescriptions;
