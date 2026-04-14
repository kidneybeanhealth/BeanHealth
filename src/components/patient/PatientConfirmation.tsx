/**
 * Patient Confirmation Screen
 * Shows patient details after MR ID lookup — confirms identity
 * Supports Tamil (default) ↔ English
 */
import React from 'react';
import { usePatientApp } from '../../contexts/PatientAppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import '../../styles/patient.css';

interface Props {
  onConfirm: () => void;
  onReject: () => void;
}

const PatientConfirmation: React.FC<Props> = ({ onConfirm, onReject }) => {
  const { session } = usePatientApp();
  const { t, lang } = useLanguage();

  if (!session) return null;

  const { patient, hospital, doctor, latestVisitDate, department } = session;

  const confirmationHint = lang === 'ta'
    ? 'இது உங்கள் கணக்கு தானா? உறுதிப்படுத்துங்கள்.'
    : 'Is this your account? Please confirm.';

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getInitial = (name: string) => {
    const cleaned = name.replace(/^(MR\.|MRS\.|MS\.|DR\.)\s*/i, '').trim();
    return cleaned.charAt(0)?.toUpperCase() || '?';
  };

  const detailRows = [
    {
      key: 'fatherHusband',
      label: t('confirm.fatherHusband'),
      value: patient.father_husband_name || null,
    },
    {
      key: 'ageGender',
      label: `${t('confirm.age')} / ${t('confirm.gender')}`,
      value: `${patient.age ? `${patient.age} ${t('confirm.yrs')}` : '—'}${patient.gender ? `, ${patient.gender}` : ''}`,
    },
    {
      key: 'visitDate',
      label: t('confirm.visitDate'),
      value: formatDate(latestVisitDate),
    },
    {
      key: 'hospital',
      label: t('confirm.hospital'),
      value: hospital ? (hospital.display_name || hospital.hospital_name) : null,
    },
    {
      key: 'department',
      label: t('confirm.department'),
      value: department || null,
    },
    {
      key: 'doctor',
      label: t('confirm.doctor'),
      value: doctor ? `Dr. ${doctor.name}` : null,
    },
  ].filter((row) => Boolean(row.value));

  return (
    <div className="pa-confirm">
      <div className="pa-confirm-card">
        <div className="pa-confirm-head">
          <div className="pa-confirm-logo-wrap">
            <div className="pa-confirm-logo-circle">
              <img src="/logo.png" alt="BeanHealth" />
            </div>
            <span className="pa-confirm-brand">
              Bean<span>Health</span>
            </span>
          </div>

          <div className="pa-confirm-identity">
            <div className="pa-confirm-avatar">
              {getInitial(patient.name)}
            </div>
            <div className="pa-confirm-main-text">
              <h2 className="pa-confirm-name">{patient.name}</h2>
              <p className="pa-confirm-mr">MR: {patient.mr_number}</p>
              <p className="pa-confirm-hint">{confirmationHint}</p>
            </div>
          </div>
        </div>

        <div className="pa-confirm-details">
          {detailRows.map((row) => (
            <div className="pa-confirm-row" key={row.key}>
              <div className="pa-confirm-row-label">{row.label}</div>
              <div className="pa-confirm-row-value">
                {row.key === 'ageGender' ? (
                  <span style={{ textTransform: 'capitalize' }}>{row.value}</span>
                ) : (
                  row.value
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="pa-confirm-actions">
          <button className="pa-btn-primary" onClick={onConfirm}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {t('confirm.yes')}
          </button>
          <button className="pa-btn-secondary" onClick={onReject}>
            {t('confirm.no')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientConfirmation;
