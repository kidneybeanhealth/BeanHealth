/**
 * Vitals Card – BP (scroll picker), Blood Glucose, Weight, Urine Output
 * Supports Tamil (default) ↔ English
 */
import React, { useState, useEffect } from 'react';
import { usePatientApp } from '../../contexts/PatientAppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import BPScrollPicker from './BPScrollPicker';
import SuccessReceiptModal, { ReceiptItem } from './SuccessReceiptModal';

// SVG icon components
const HeartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface Props {
  onOpenUrineModal: () => void;
}

const VitalsCard: React.FC<Props> = ({ onOpenUrineModal }) => {
  const { vitals, saveVitals, urineOutputs } = usePatientApp();
  const { t } = useLanguage();

  const [systole, setSystole] = useState<number | null>(vitals?.bp_systole || null);
  const [diastole, setDiastole] = useState<number | null>(vitals?.bp_diastole || null);
  const [glucose, setGlucose] = useState(vitals?.blood_glucose?.toString() || '');
  const [weight, setWeight] = useState(vitals?.weight?.toString() || '');
  
  const [showBPPicker, setShowBPPicker] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);

  useEffect(() => {
    if (vitals) {
      if (vitals.bp_systole) setSystole(vitals.bp_systole);
      if (vitals.bp_diastole) setDiastole(vitals.bp_diastole);
      setGlucose(vitals.blood_glucose?.toString() || '');
      setWeight(vitals.weight?.toString() || '');
    }
  }, [vitals]);

  const checkAllComplete = (updatedField: string, val: any) => {
    const sys = updatedField === 'bp' ? val.sys : vitals?.bp_systole;
    const dia = updatedField === 'bp' ? val.dia : vitals?.bp_diastole;
    const g = updatedField === 'glucose' ? val : vitals?.blood_glucose;
    const w = updatedField === 'weight' ? val : vitals?.weight;

    if (sys && dia && g && w) {
      setReceiptItems([
        { label: t('vitals.bp'), value: `${sys}/${dia} mmHg` },
        { label: t('vitals.glucose'), value: `${g} mg/dL` },
        { label: t('vitals.weight'), value: `${w} kg` }
      ]);
      setShowReceipt(true);
    }
  };

  const handleBPConfirm = async (sys: number, dia: number) => {
    setSystole(sys);
    setDiastole(dia);
    setShowBPPicker(false);

    setSavingField('bp');
    try {
      await saveVitals({ bp_systole: sys, bp_diastole: dia });
      checkAllComplete('bp', { sys, dia });
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveVital = async (field: 'bp' | 'glucose' | 'weight') => {
    setSavingField(field);
    
    if (field === 'bp') {
      if (systole !== null && diastole !== null) {
        await saveVitals({ bp_systole: systole, bp_diastole: diastole });
        checkAllComplete('bp', { sys: systole, dia: diastole });
      }
    } else {
      const val = parseFloat(field === 'glucose' ? glucose : weight);
      if (!isNaN(val)) {
        await saveVitals(field === 'glucose' ? { blood_glucose: val } : { weight: val });
        checkAllComplete(field, val);
      }
    }
    setSavingField(null);
  };

  const urineTotal = urineOutputs.reduce((sum, u) => sum + u.amount_ml, 0);
  const hasBP = systole !== null && diastole !== null;

  const gVal = parseFloat(glucose);
  const wVal = parseFloat(weight);
  
  const isBpChanged = systole !== vitals?.bp_systole || diastole !== vitals?.bp_diastole;
  const isGlucoseChanged = !isNaN(gVal) && gVal !== vitals?.blood_glucose;
  const isWeightChanged = !isNaN(wVal) && wVal !== vitals?.weight;
  
  const isBpSaved = vitals?.bp_systole != null && systole === vitals?.bp_systole && diastole === vitals?.bp_diastole;
  const isGlucoseSaved = !isNaN(gVal) && gVal === vitals?.blood_glucose && vitals?.blood_glucose != null;
  const isWeightSaved = !isNaN(wVal) && wVal === vitals?.weight && vitals?.weight != null;

  return (
    <>
      <div className="pa-card">
        <div className="pa-card-header">
          <div className="pa-card-title">
            <div className="pa-card-icon green"><HeartIcon /></div>
            {t('vitals.title')}
          </div>
          <span className="pa-card-badge">{t('vitals.today')}</span>
        </div>

        {/* Blood Pressure — Tap to open scroll picker */}
        <div className="pa-vital-row pa-grid-row pa-bp-row">
          <div className="pa-vital-label">{t('vitals.bp')}</div>

          <div className="pa-bp-control-stack">
            <div className="pa-bp-meta-row">
              <button
                type="button"
                onClick={() => setShowBPPicker(true)}
                className={`pa-bp-pill ${hasBP ? 'has-value' : 'is-empty'}`}
                aria-label={t('bp.title')}
              >
                <span className="pa-bp-value pa-bp-systole">
                  {hasBP ? systole : '—'}
                </span>
                <span className="pa-bp-separator-inline">/</span>
                <span className="pa-bp-value pa-bp-diastole">
                  {hasBP ? diastole : '—'}
                </span>
              </button>
              <span className="pa-vital-unit">mmHg</span>
            </div>

            <div className="pa-bp-action-row">
              {savingField === 'bp' && (
                <button className="pa-vital-action" disabled>
                  <div className="pa-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                </button>
              )}
              {isBpSaved && (
                 <button className="pa-vital-action saved" disabled><CheckIcon />{t('action.saved')}</button>
              )}
              {savingField !== 'bp' && !isBpSaved && <div className="pa-vital-spacer" />}
            </div>
          </div>
        </div>

        {/* Blood Glucose */}
        <div className="pa-vital-row pa-grid-row pa-vital-standard-row">
          <div className="pa-vital-label">{t('vitals.glucose')}</div>

          <div className="pa-vital-control-stack">
            <div className="pa-vital-meta-row">
              <input
                type="number"
                className="pa-vital-input"
                placeholder="—"
                value={glucose}
                onChange={e => setGlucose(e.target.value)}
                inputMode="decimal"
              />
              <span className="pa-vital-unit">mg/dL</span>
            </div>

            <div className="pa-vital-action-row">
              {isGlucoseChanged && (
                <button className="pa-vital-action" onClick={() => handleSaveVital('glucose')} disabled={savingField === 'glucose'}>
                  {savingField === 'glucose' ? <div className="pa-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : t('action.save')}
                </button>
              )}
              {isGlucoseSaved && (
                <button className="pa-vital-action saved" disabled><CheckIcon />{t('action.saved')}</button>
              )}
              {!isGlucoseChanged && !isGlucoseSaved && <div className="pa-vital-action-placeholder" />}
            </div>
          </div>
        </div>

        {/* Weight */}
        <div className="pa-vital-row pa-grid-row pa-vital-standard-row">
          <div className="pa-vital-label">{t('vitals.weight')}</div>

          <div className="pa-vital-control-stack">
            <div className="pa-vital-meta-row">
              <input
                type="number"
                className="pa-vital-input"
                placeholder="—"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                inputMode="decimal"
                step="0.1"
              />
              <span className="pa-vital-unit">kg</span>
            </div>

            <div className="pa-vital-action-row">
              {isWeightChanged && (
                <button className="pa-vital-action" onClick={() => handleSaveVital('weight')} disabled={savingField === 'weight'}>
                  {savingField === 'weight' ? <div className="pa-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : t('action.save')}
                </button>
              )}
              {isWeightSaved && (
                <button className="pa-vital-action saved" disabled><CheckIcon />{t('action.saved')}</button>
              )}
              {!isWeightChanged && !isWeightSaved && <div className="pa-vital-action-placeholder" />}
            </div>
          </div>
        </div>

        {/* Urine Output */}
        <div className="pa-vital-row" style={{ borderBottom: 'none' }}>
          <div style={{ flex: 1 }}>
            <div className="pa-vital-label" style={{ marginBottom: 4 }}>{t('vitals.urineOutput')}</div>
            {urineOutputs.length > 0 && (
              <div className="pa-urine-list">
                {urineOutputs.slice(0, 3).map(u => (
                  <div key={u.id} className="pa-urine-entry">
                    <span className="pa-urine-time">
                      {new Date(u.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="pa-urine-amount">{u.amount_ml} ml</span>
                  </div>
                ))}
                {urineOutputs.length > 3 && (
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>+{urineOutputs.length - 3} {t('vitals.more')}</span>
                )}
              </div>
            )}
            {urineTotal > 0 && (
              <div className="pa-urine-total">
                <span style={{ color: '#6EA530' }}>{t('vitals.total')}</span>
                <span style={{ color: '#1A1A1A' }}>{urineTotal} ml</span>
              </div>
            )}
          </div>
          <button className="pa-fab" onClick={onOpenUrineModal} title={t('vitals.addUrine')}>
            <PlusIcon />
          </button>
        </div>
      </div>

      {/* BP Scroll Picker Modal */}
      {showBPPicker && (
        <BPScrollPicker
          systole={systole}
          diastole={diastole}
          onConfirm={handleBPConfirm}
          onClose={() => setShowBPPicker(false)}
        />
      )}

      {/* Success Receipt Modal */}
      <SuccessReceiptModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        titleKey="receipt.vitalsTitle"
        items={receiptItems}
      />
    </>
  );
};

export default VitalsCard;
