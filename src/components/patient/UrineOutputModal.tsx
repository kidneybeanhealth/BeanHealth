/**
 * Urine Output Modal — Bottom sheet for adding urine output entries
 * Supports Tamil (default) ↔ English
 */
import React, { useState, useRef, useEffect } from 'react';
import { usePatientApp } from '../../contexts/PatientAppContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_AMOUNTS = [50, 100, 150, 200, 250, 300, 400, 500];

const UrineOutputModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { addUrineOutput } = usePatientApp();
  const { t } = useLanguage();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setNotes('');
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const ml = parseInt(amount);
    if (isNaN(ml) || ml <= 0) return;

    setSaving(true);
    await addUrineOutput(ml, notes || undefined);
    setSaving(false);
    onClose();
  };

  return (
    <div className="pa-modal-overlay" onClick={onClose}>
      <div className="pa-modal" onClick={e => e.stopPropagation()}>
        <div className="pa-modal-handle" />
        <h3 className="pa-modal-title">{t('urine.title')}</h3>

        <div className="pa-input-group">
          <label className="pa-input-label">{t('urine.amountLabel')}</label>
          <input
            ref={inputRef}
            type="number"
            className="pa-input"
            placeholder={t('urine.amountPlaceholder')}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            inputMode="numeric"
            style={{ fontSize: 24, fontWeight: 800 }}
          />
        </div>

        {/* Quick amount buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {QUICK_AMOUNTS.map(ml => (
            <button
              key={ml}
              className={`pa-preset-btn ${amount === ml.toString() ? 'active' : ''}`}
              onClick={() => setAmount(ml.toString())}
              style={{ flex: '1 0 calc(25% - 8px)', minWidth: 60, padding: '10px 8px', fontSize: 13 }}
            >
              {ml} ml
            </button>
          ))}
        </div>

        <div className="pa-input-group">
          <label className="pa-input-label">{t('urine.notesLabel')}</label>
          <input
            type="text"
            className="pa-input"
            placeholder={t('urine.notesPlaceholder')}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0 }}
          />
        </div>

        <button
          className="pa-btn-primary"
          onClick={handleSave}
          disabled={!amount || parseInt(amount) <= 0 || saving}
          style={{ marginTop: 8 }}
        >
          {saving ? (
            <><div className="pa-spinner" /> {t('urine.saving')}</>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t('urine.save')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default UrineOutputModal;
