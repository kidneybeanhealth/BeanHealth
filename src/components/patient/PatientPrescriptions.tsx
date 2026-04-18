/**
 * Patient Prescriptions Tab — Tap to open the actual PrescriptionModal (same as enterprise)
 * Supports Tamil (default) ↔ English
 */
import React, { useEffect, useState } from 'react';
import { usePatientApp } from '../../contexts/PatientAppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getProxiedUrl, supabase } from '../../lib/supabase';
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
  const [pdfRx, setPdfRx] = useState<any | null>(null);
  const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);

  const resolveHospitalLogo = async (hospitalId: string): Promise<string | null> => {
    // Primary: hospital profile row keyed by id.
    const byId = await (supabase as any)
      .from('hospital_profiles')
      .select('hospital_logo')
      .eq('id', hospitalId)
      .maybeSingle();

    if (byId?.data?.hospital_logo) {
      return byId.data.hospital_logo;
    }

    // Compatibility: some deployments use hospital_id as key in hospital_profiles.
    const byHospitalId = await (supabase as any)
      .from('hospital_profiles')
      .select('hospital_logo')
      .eq('hospital_id', hospitalId)
      .maybeSingle();

    return byHospitalId?.data?.hospital_logo || null;
  };

  useEffect(() => {
    const handlePopState = () => {
      if (selectedRx) {
        setSelectedRx(null);
      }
      if (pdfRx) {
        setPdfRx(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedRx, pdfRx]);

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

  const openPdf = async () => {
    if (!selectedRx) return;

    const hospitalId = session?.hospital?.id || session?.patient?.hospital_id;
    if (hospitalId) {
      try {
        const logo = await resolveHospitalLogo(hospitalId);
        setHospitalLogo(logo);
      } catch (e) {
        console.warn('Could not resolve hospital logo before opening PDF', e);
        setHospitalLogo(null);
      }
    }

    setSelectedRx(null);
    setPdfRx(selectedRx);
  };

  const closePdf = () => {
    if (window.history.state?.modalOpen) {
      window.history.back();
    } else {
      setPdfRx(null);
    }
  };

  const normalizeMedicationRows = (rx: any) => {
    const meds = Array.isArray(rx?.medications) ? rx.medications : [];
    return meds.map((med: any, index: number) => {
      const frequency = med?.frequency || [med?.morning, med?.noon, med?.evening, med?.night].filter(Boolean).join('-');
      const timingParts = [
        med?.morningTime ? `M: ${med.morningTime}` : '',
        med?.noonTime ? `N: ${med.noonTime}` : '',
        med?.eveningTime ? `E: ${med.eveningTime}` : '',
        med?.nightTime ? `Ni: ${med.nightTime}` : ''
      ].filter(Boolean);

      const dosage = med?.dosage_value || med?.dosage || '';
      const quantity = med?.quantity || '';
      const foodTiming = med?.foodTiming || med?.instruction || '';

      return {
        key: `${rx?.id || 'rx'}-${index}`,
        name: med?.name || 'Unnamed medicine',
        dosage,
        quantity,
        frequency,
        foodTiming,
        timings: timingParts.join('  |  ')
      };
    });
  };

  useEffect(() => { refreshPrescriptions(); }, []);

  useEffect(() => {
    const hospitalId = session?.hospital?.id || session?.patient?.hospital_id;
    if (!hospitalId) {
      setHospitalLogo(null);
      return;
    }

    let isActive = true;

    // Clear previous logo immediately to avoid showing stale cross-hospital logo while loading.
    setHospitalLogo(null);

    const fetchLogo = async () => {
      try {
        const logo = await resolveHospitalLogo(hospitalId);

        if (!isActive) return;
        setHospitalLogo(logo);
      } catch (e) {
        console.warn('Could not fetch hospital logo for patient app', e);
        if (isActive) {
          setHospitalLogo(null);
        }
      }
    };

    fetchLogo();

    return () => {
      isActive = false;
    };
  }, [session?.hospital?.id, session?.patient?.hospital_id]);

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
        <div className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm p-3 sm:p-4 flex items-end sm:items-center justify-center" onClick={closeRx}>
          <div className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Prescription Details</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
                  {fmtDate(selectedRx.created_at)}{selectedRx?.doctor?.name ? ` • Dr. ${selectedRx.doctor.name}` : ''}
                </p>
              </div>
              <button onClick={closeRx} className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3 bg-gray-50/70">
              {normalizeMedicationRows(selectedRx).length === 0 ? (
                <p className="text-sm text-gray-500">No medication rows available.</p>
              ) : (
                normalizeMedicationRows(selectedRx).map((row: any, idx: number) => (
                  <div key={row.key} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">{idx + 1}. {row.name}</h4>
                      {row.dosage && <span className="text-[11px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">{row.dosage}</span>}
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                      <p className="text-gray-700"><span className="font-semibold text-gray-900">Frequency:</span> {row.frequency || '-'}</p>
                      <p className="text-gray-700"><span className="font-semibold text-gray-900">Qty:</span> {row.quantity || '-'}</p>
                      <p className="text-gray-700 sm:col-span-2"><span className="font-semibold text-gray-900">Food Timing:</span> {row.foodTiming || '-'}</p>
                      <p className="text-gray-700 sm:col-span-2"><span className="font-semibold text-gray-900">Times:</span> {row.timings || '-'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
              <button onClick={closeRx} className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200">Close</button>
              <button onClick={openPdf} className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gray-900 text-white font-semibold hover:bg-black">Open PDF</button>
            </div>
          </div>
        </div>
      )}
      {pdfRx && (
        <PrescriptionModal
          doctor={pdfRx.doctor || { name: '', specialty: '' }}
          patient={session?.patient || { name: '', mr_number: '', age: '' }}
          onClose={closePdf}
          readOnly={true}
          forceDesktop={true}
          existingData={pdfRx}
          clinicLogo={hospitalLogo ? getProxiedUrl(hospitalLogo) : undefined}
        />
      )}
    </>
  );
};

export default PatientPrescriptions;
