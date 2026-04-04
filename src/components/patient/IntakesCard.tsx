/**
 * Intakes Card — Salt (gm/day) & Fluid (litre/day) — SVG icons
 * Supports Tamil (default) ↔ English
 */
import React, { useState, useEffect } from 'react';
import { usePatientApp } from '../../contexts/PatientAppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import SuccessReceiptModal, { ReceiptItem } from './SuccessReceiptModal';

const DropletIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const FLUID_PRESETS = [100, 200, 300, 500];

const IntakesCard: React.FC = () => {
  const { intakes, saveIntakes, prescribedSalt, prescribedFluid } = usePatientApp();
  const { t } = useLanguage();

  const [salt, setSalt] = useState(intakes?.salt_intake_gm?.toString() || '');
  const [fluid, setFluid] = useState(intakes?.fluid_intake_ml?.toString() || '');
  
  const [savingField, setSavingField] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);


  useEffect(() => {
    if (intakes) {
      setSalt(intakes.salt_intake_gm?.toString() || '');
      setFluid(intakes.fluid_intake_ml?.toString() || '');
    }
  }, [intakes]);

  const checkAllComplete = (updatedField: string, val: number) => {
    const s = updatedField === 'salt' ? val : intakes?.salt_intake_gm;
    const f = updatedField === 'fluid' ? val : intakes?.fluid_intake_ml;

    if (s != null && f != null) {
      setReceiptItems([
        { label: t('intakes.salt'), value: `${s} gm` },
        { label: t('intakes.fluid'), value: `${f} ml` }
      ]);
      setShowReceipt(true);
    }
  };

  const handleSaveText = async (field: 'salt' | 'fluid') => {
    setSavingField(field);
    const val = parseFloat(field === 'salt' ? salt : fluid);
    if (!isNaN(val)) {
      await saveIntakes(field === 'salt' ? { salt_intake_gm: val } : { fluid_intake_ml: val });
      checkAllComplete(field, val);
    }
    setSavingField(null);
  };

  const addFluidPreset = (ml: number) => {
    const current = parseFloat(fluid) || 0;
    const newVal = current + ml;
    setFluid(newVal.toString());
  };

  const sVal = parseFloat(salt);
  const fVal = parseFloat(fluid);
  
  const isSaltChanged = !isNaN(sVal) && sVal !== intakes?.salt_intake_gm;
  const isFluidChanged = !isNaN(fVal) && fVal !== intakes?.fluid_intake_ml;
  
  const isSaltSaved = !isNaN(sVal) && sVal === intakes?.salt_intake_gm && intakes?.salt_intake_gm != null;
  const isFluidSaved = !isNaN(fVal) && fVal === intakes?.fluid_intake_ml && intakes?.fluid_intake_ml != null;

  return (
    <>
      <div className="pa-card">
        <div className="pa-card-header">
          <div className="pa-card-title">
            <div className="pa-card-icon blue"><DropletIcon /></div>
            {t('intakes.title')}
          </div>
          {(prescribedSalt || prescribedFluid) && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#6EA530',
              background: '#F0F7E6', padding: '3px 8px', borderRadius: 99,
            }}>
              {t('intakes.prescribed')}
            </span>
          )}
        </div>

        {/* Salt Intake */}
        <div className="pa-intake-row pa-grid-row">
          <div style={{ flex: 1 }}>
            <div className="pa-vital-label">{t('intakes.salt')}</div>
            {prescribedSalt && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#8AC43C' }}>
                {t('intakes.limit')}: {prescribedSalt} gm/day
              </span>
            )}
          </div>
          <input type="number" className="pa-vital-input" placeholder="—"
            value={salt} onChange={e => setSalt(e.target.value)}
            inputMode="decimal" step="0.5" />
          <span className="pa-vital-unit">gm</span>
          
          {isSaltChanged && (
            <button className="pa-vital-action" onClick={() => handleSaveText('salt')} disabled={savingField === 'salt'}>
              {savingField === 'salt' ? <div className="pa-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : t('action.save')}
            </button>
          )}
          {isSaltSaved && (
            <button className="pa-vital-action saved" disabled><CheckIcon />{t('action.saved')}</button>
          )}
          {!isSaltChanged && !isSaltSaved && <div style={{ minWidth: 60 }} />}
        </div>

        {/* Fluid Intake */}
        <div className="pa-intake-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div className="pa-grid-row">
            <div style={{ flex: 1 }}>
              <div className="pa-vital-label">{t('intakes.fluid')}</div>
              {prescribedFluid && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#8AC43C' }}>
                  {t('intakes.limit')}: {prescribedFluid} lit/day
                </span>
              )}
            </div>
            <input type="number" className="pa-vital-input" placeholder="—"
              value={fluid} onChange={e => setFluid(e.target.value)}
              inputMode="numeric" />
            <span className="pa-vital-unit">ml</span>
            
            {isFluidChanged && (
              <button className="pa-vital-action" onClick={() => handleSaveText('fluid')} disabled={savingField === 'fluid'}>
                {savingField === 'fluid' ? <div className="pa-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : t('action.save')}
              </button>
            )}
            {isFluidSaved && (
              <button className="pa-vital-action saved" disabled><CheckIcon />{t('action.saved')}</button>
            )}
            {!isFluidChanged && !isFluidSaved && <div style={{ minWidth: 60 }} />}
          </div>
          <div className="pa-intake-presets">
            {FLUID_PRESETS.map(ml => (
              <button key={ml} className="pa-preset-btn" onClick={() => addFluidPreset(ml)}>+{ml}ml</button>
            ))}
          </div>
        </div>
      </div>

      <SuccessReceiptModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        titleKey="receipt.intakesTitle"
        items={receiptItems}
      />
    </>
  );
};

export default IntakesCard;
