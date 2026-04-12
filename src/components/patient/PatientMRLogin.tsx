/**
 * Patient MR ID Login Screen
 * VisionOS-inspired frosted glass card with BeanHealth branding
 * Supports Tamil (default) ↔ English
 */
import React, { useState, useRef, useEffect } from 'react';
import { usePatientApp } from '../../contexts/PatientAppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import '../../styles/patient.css';

const PatientMRLogin: React.FC = () => {
  const { login, isLoading, error } = usePatientApp();
  const { t, lang, setLang } = useLanguage();
  const [mrId, setMrId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!mrId.trim()) {
      setLocalError(t('login.enterMR'));
      inputRef.current?.focus();
      return;
    }

    const err = await login(mrId.trim());
    if (err) {
      setLocalError(err);
    }
  };

  const displayError = localError || error;

  return (
    <div className="pa-login">
      {/* Language toggle on login page */}
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
        <div className="pa-lang-toggle">
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
      </div>

      <form onSubmit={handleSubmit} className="pa-login-card">
        {/* Logo + Brand */}
        <div className="pa-login-logo-wrap">
          <div className="pa-login-logo-circle">
            <img src="/logo.png" alt="BeanHealth" />
          </div>
          <div className="pa-login-brand">Bean<span>Health</span></div>
        </div>

        <h1 className="pa-login-title">{t('login.title')}</h1>
        <p className="pa-login-subtitle">{t('login.subtitle')}</p>

        <div className="pa-input-group">
          <label className="pa-input-label">{t('login.mrLabel')}</label>
          <input
            ref={inputRef}
            type="text"
            className={`pa-input ${displayError ? 'pa-input-error' : ''}`}
            placeholder="e.g. KNH/22/026137"
            value={mrId}
            onChange={(e) => {
              setMrId(e.target.value.toUpperCase());
              setLocalError(null);
            }}
            autoComplete="off"
            autoCapitalize="characters"
            disabled={isLoading}
          />
          {displayError && (
            <p className="pa-error-text">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {displayError}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="pa-btn-primary"
          disabled={isLoading || !mrId.trim()}
        >
          {isLoading ? (
            <>
              <div className="pa-spinner" />
              {t('login.lookingUp')}
            </>
          ) : (
            <>
              {t('login.continue')}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <p style={{
        fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.25)',
        marginTop: 32, textAlign: 'center',
      }}>
        {t('login.footer')}
      </p>
    </div>
  );
};

export default PatientMRLogin;
