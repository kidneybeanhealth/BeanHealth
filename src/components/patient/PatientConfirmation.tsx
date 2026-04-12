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

  return (
    <div className="pa-confirm">
      <div className="pa-confirm-card">
        {/* Logo */}
        <div className="pa-confirm-logo-wrap">
          <div className="pa-confirm-logo-circle">
            <img src="/logo.png" alt="BeanHealth" />
          </div>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 800, color: '#1A1A1A', letterSpacing: -0.3 }}>
            Bean<span style={{ color: '#8AC43C' }}>Health</span>
          </span>
        </div>

        {/* Avatar */}
        <div className="pa-confirm-avatar">
          {getInitial(patient.name)}
        </div>

        <h2 className="pa-confirm-name">{patient.name}</h2>
        <p className="pa-confirm-mr">MR: {patient.mr_number}</p>

        {/* Details Grid */}
        <div className="pa-detail-grid">
          {patient.father_husband_name && (
            <div className="pa-detail-item full-width">
              <div className="pa-detail-label">{t('confirm.fatherHusband')}</div>
              <div className="pa-detail-value">{patient.father_husband_name}</div>
            </div>
          )}

          <div className="pa-detail-item">
            <div className="pa-detail-label">{t('confirm.age')}</div>
            <div className="pa-detail-value">{patient.age ? `${patient.age} ${t('confirm.yrs')}` : '—'}</div>
          </div>

          <div className="pa-detail-item">
            <div className="pa-detail-label">{t('confirm.gender')}</div>
            <div className="pa-detail-value" style={{ textTransform: 'capitalize' }}>
              {patient.gender || '—'}
            </div>
          </div>

          <div className="pa-detail-item full-width">
            <div className="pa-detail-label">{t('confirm.visitDate')}</div>
            <div className="pa-detail-value">{formatDate(latestVisitDate)}</div>
          </div>

          {hospital && (
            <div className="pa-detail-item full-width">
              <div className="pa-detail-label">{t('confirm.hospital')}</div>
              <div className="pa-detail-value">
                {hospital.display_name || hospital.hospital_name}
              </div>
            </div>
          )}

          {department && (
            <div className="pa-detail-item">
              <div className="pa-detail-label">{t('confirm.department')}</div>
              <div className="pa-detail-value">{department}</div>
            </div>
          )}

          {doctor && (
            <div className="pa-detail-item">
              <div className="pa-detail-label">{t('confirm.doctor')}</div>
              <div className="pa-detail-value">Dr. {doctor.name}</div>
            </div>
          )}
        </div>

        {/* Actions */}
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
