import React from 'react';
import { usePatientApp } from '../../contexts/PatientAppContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  onConfirm: () => void;
  onReject: () => void;
}

const PatientConfirmation: React.FC<Props> = ({ onConfirm, onReject }) => {
  const { session } = usePatientApp();
  const { lang } = useLanguage();

  if (!session) return null;

  const { patient, hospital, doctor, latestVisitDate } = session;

  const T = {
    en: {
      title: 'Confirm Identity',
      subtitle: 'Is this your account?',
      mr: 'MR',
      age: 'Age',
      yrs: 'yrs',
      gender: 'Gender',
      hospital: 'Hospital',
      doctor: 'Doctor',
      lastVisit: 'Last Visit',
      confirm: 'Yes, this is me',
      reject: "Not me",
    },
    ta: {
      title: 'அடையாளம் உறுதிப்படுத்தல்',
      subtitle: 'இது உங்கள் கணக்கு தானா?',
      mr: 'MR',
      age: 'வயது',
      yrs: 'வயது',
      gender: 'பாலினம்',
      hospital: 'மருத்துவமனை',
      doctor: 'மருத்துவர்',
      lastVisit: 'கடைசி வருகை',
      confirm: 'ஆம், இது நான்',
      reject: 'இல்லை',
    },
  };
  const t = T[lang as 'en' | 'ta'] ?? T.en;

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return d; }
  };

  const initial = patient.name.replace(/^(MR\.|MRS\.|MS\.|DR\.)\s*/i, '').charAt(0).toUpperCase() || '?';
  const displayName = patient.name.replace(/^(MR\.|MRS\.|MS\.|DR\.)\s*/i, '').trim();
  const hospitalName = hospital ? (hospital.display_name || hospital.hospital_name) : null;

  const rows = [
    patient.age != null && { label: `${t.age} / ${t.gender}`, value: `${patient.age} ${t.yrs}${patient.gender ? `, ${patient.gender}` : ''}` },
    hospitalName && { label: t.hospital, value: hospitalName },
    doctor && { label: t.doctor, value: `Dr. ${doctor.name}` },
    latestVisitDate && { label: t.lastVisit, value: formatDate(latestVisitDate) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div
      className="patient-app min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, hsl(151 22% 95%) 0%, hsl(60 11% 97%) 100%)' }}
    >
      <div className="w-full max-w-md animate-fadeInUp">
        <div className="bg-white rounded-2xl shadow-xl border border-border overflow-hidden">
          {/* Header strip */}
          <div className="px-7 pt-6 pb-5 border-b border-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: 'hsl(var(--primary))' }}>
              <img src="/logo.png" alt="BeanHealth" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                BeanHealth
              </h1>
              <p className="text-xs text-muted-foreground">{t.title}</p>
            </div>
          </div>

          {/* Identity block */}
          <div className="px-7 py-6">
            <p className="text-xs text-muted-foreground font-medium mb-4">{t.subtitle}</p>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
                style={{ background: 'hsl(var(--primary))' }}>
                {initial}
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground leading-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {displayName}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t.mr}: {patient.mr_number}</p>
              </div>
            </div>

            {rows.length > 0 && (
              <div className="rounded-xl overflow-hidden border border-border">
                {rows.map((row, i) => (
                  <div key={i} className={`flex justify-between px-4 py-3 ${i < rows.length - 1 ? 'border-b border-border' : ''}`}>
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-xs font-semibold text-foreground text-right max-w-[55%] leading-tight" style={{ textTransform: 'capitalize' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-7 pb-7 flex flex-col gap-3">
            <button
              onClick={onConfirm}
              className="w-full h-12 rounded-xl text-base font-semibold text-white flex items-center justify-center gap-2 transition-opacity active:opacity-80"
              style={{ background: 'hsl(var(--primary))' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t.confirm}
            </button>
            <button
              onClick={onReject}
              className="w-full h-11 rounded-xl text-sm font-medium text-muted-foreground border border-border bg-white transition-colors hover:bg-gray-50"
            >
              {t.reject}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientConfirmation;
